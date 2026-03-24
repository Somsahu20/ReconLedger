from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from app.config import settings
from app.services.extractor import MODEL
from langchain_core.output_parsers import JsonOutputParser
from utils.log import logger
from google.api_core import exceptions as google_exceptions


class GeminiService:
    def __init__(self):
        self.llm = ChatGoogleGenerativeAI(
            model=MODEL,
            google_api_key=settings.RECONCILIATION_API,
            temperature=0.0,
            max_tokens=4096,
            generation_config={
                "response_mime_type": "application/json"  
            }
        )

        self.json_parser = JsonOutputParser()

    async def fuzzy_match_invoices(
        self,
        unmatched_listing: list[dict], #! Got from excel/csv file uploaded
        system_invoices: list[dict], #! Got from reconciliation.py
    ) -> dict | None:
        if not unmatched_listing or not system_invoices:
            return {"matches": []}

        BATCH_SIZE = 30
        all_matches = []
        all_unresolvable = []

        system_text = "\n".join([
                f"  [{i}] Invoice: {r['invoice_number']}, "
                f"Vendor: {r['vendor_name']}, "
                f"Date: {r['date']}, Amount: {r['amount']}, "
                f"Tax: {r['tax_amount']}"
                for i, r in enumerate(system_invoices)
            ])

        for batch_start in range(0, len(unmatched_listing), BATCH_SIZE):

            single_batch = unmatched_listing[batch_start:batch_start + BATCH_SIZE]


            listing_text = "\n".join([
                f"  [{i}] Invoice: {r['invoice_number']}, "
                f"Vendor: {r['vendor_name']}, "
                f"Date: {r['date']}, Amount: {r['amount']}, "
                f"Tax: {r['tax_amount']}"
                for i, r in enumerate(single_batch)
            ])


            

            prompt = f"""<role>You are an expert financial auditor performing invoice reconciliation. You have zero tolerance for assumptions or fabricated data.</role>

            <task>
            Match UNMATCHED LISTING ENTRIES to AVAILABLE SYSTEM INVOICES.
            Be conservative — an uncertain match is worse than no match.
            </task>

            <input_data>
            <listing_entries>
            {listing_text}
            </listing_entries>

            <system_invoices>
            {system_text}
            </system_invoices>
            </input_data>

            <matching_rules>
            Apply in strict priority order:

            RULE 1 - AMOUNT (40% weight):
            - Exact match = strong indicator
            - Difference less than 1% = rounding, acceptable
            - Difference 1 to 5% = partial payment, flag as discrepancy
            - Difference more than 5% = only match if ALL other fields are exact

            RULE 2 - INVOICE NUMBER (30% weight):
            - Strip all non-alphanumeric characters before comparing
            - INV-001, INV001, 001 are all equivalent
            - Leading zeros are insignificant (001 = 1)
            - Never match on invoice number alone if amount differs more than 5%

            RULE 3 - VENDOR NAME (20% weight):
            - Normalize to lowercase, remove punctuation
            - CORP = CORPORATION, LTD = LIMITED, INC = INCORPORATED, CO = COMPANY
            - Flag if name similarity is below 60%

            RULE 4 - DATE (10% weight):
            - Exact = strong indicator
            - Within 7 days = acceptable posting delay
            - Within 30 days = flag as discrepancy
            - Beyond 30 days = only accept if amount and invoice number are exact
            </matching_rules>

            <confidence_thresholds>
            - 0.95 to 1.00 = All 4 fields match exactly or near-exactly
            - 0.80 to 0.94 = 3 fields match with 1 minor discrepancy
            - 0.65 to 0.79 = 2 to 3 fields match with notable discrepancies
            - Below 0.65 = DO NOT MATCH, place in unresolvable
            </confidence_thresholds>

            <strict_constraints>
            - ONLY use values explicitly present in the input data
            - NEVER infer, assume, or fabricate any field value
            - NEVER match solely on vendor name or date alone
            - NEVER reference a listing_index or system_index that does not exist in the input
            - Each listing_index must appear exactly once across matches and unresolvable combined
            - Each system_index must appear at most once across all matches
            - Every listing entry must appear in either matches or unresolvable with no omissions
            </strict_constraints>

            <self_check>
            Before responding, verify each of the following:
            1. Every listing_index from the input appears in either matches or unresolvable
            2. No listing_index or system_index is duplicated anywhere in the output
            3. Every matched amount difference is within the acceptable threshold for its confidence score
            4. Every reasoning value references only data explicitly visible in the input
            5. summary.total_listing_entries equals summary.matched plus summary.unresolvable
            6. Output is raw JSON only with no markdown, no backticks, no explanation text
            </self_check>

            <output_schema>
            Return ONLY raw JSON matching this exact schema with no additional text:
            {{
                "matches": [
                    {{
                        "listing_index": <integer>,
                        "system_index": <integer>,
                        "confidence": <float between 0.65 and 1.0>,
                        "match_basis": {{
                            "amount_match": "<exact|within_1pct|within_5pct|over_5pct>",
                            "invoice_number_match": "<exact|normalized|partial|none>",
                            "vendor_match": "<exact|normalized|partial|none>",
                            "date_match": "<exact|within_7d|within_30d|beyond_30d>"
                        }},
                        "reasoning": "<field-by-field explanation using only values from input>",
                        "discrepancies": ["<field>: <listing value> vs <system value>"]
                    }}
                ],
                "unresolvable": [
                    {{
                        "listing_index": <integer>,
                        "reason": "<specific reason why no match was found>"
                    }}
                ],
                "summary": {{
                    "total_listing_entries": <integer>,
                    "matched": <integer>,
                    "unresolvable": <integer>
                }}
            }}
            </output_schema>"""

            chain = self.llm | self.json_parser


            try: 
                response = await chain.ainvoke([HumanMessage(content=prompt)])

                for match in response.get("matches", []):
                    match["listing_index"] += batch_start
                for entry in response.get("unresolvable", []):
                    entry["listing_index"] += batch_start 

                all_matches.extend(response.get("matches", []))               

                all_unresolvable.extend(response.get("unresolvable", [])) 

            except ValueError as e1:
                logger.error(f"Value error in reconLLM.fuzzy_match_invoice. The error is:\n {e1}")
                raise 
            except google_exceptions.ResourceExhausted as e2:
                logger.error(f"Reconiliation api is exhausted")
                raise
            except google_exceptions.InvalidArgument as e3:
                logger.error("Bad prompt for fuzzy_match_invoices")
                raise
            except google_exceptions.GoogleAPIError as e4:
                logger.error(f"API Error in reconLLM_service.fuzzy_match_invoices. The error is: {e4}")
                raise
            except Exception as err:
                logger.error(f"Error in reconLLM_service.fuzzy_match_invoices. The error is {err}")
                raise
        
        return {
            "matches": all_matches,
            "unresolvable": all_unresolvable,
            "summary": {
                "total_listing_entries": len(unmatched_listing),
                "matched": len(all_matches),
                "unresolvable": len(all_unresolvable)
            }
        }

    async def generate_reconciliation_summary(
        self, report_data: dict
    ) -> dict:
    

        prompt = f"""<role>You are a senior financial auditor writing a formal reconciliation report. You base all findings strictly on the data provided. You never fabricate figures, infer missing values, or exaggerate risk levels.</role>

        <task>
        Analyze the reconciliation results below and produce a professional audit summary.
        Be objective, conservative, and precise. Every claim in your output must be traceable to the input data.
        </task>

        <reconciliation_data>
        <session>{report_data.get('session_name')}</session>
        <total_invoices_checked>{report_data.get('total')}</total_invoices_checked>
        <perfectly_matched>{report_data.get('matched')}</perfectly_matched>
        <mismatched_with_discrepancies>{report_data.get('mismatched')}</mismatched_with_discrepancies>
        <missing_from_system>{report_data.get('missing')}</missing_from_system>
        <total_listing_amount>{report_data.get('total_listing_amount', 0):,.2f}</total_listing_amount>
        <total_system_amount>{report_data.get('total_system_amount', 0):,.2f}</total_system_amount>
        <net_difference>{report_data.get('net_difference', 0):,.2f}</net_difference>
        <key_discrepancies>{report_data.get('top_discrepancies', 'None identified')}</key_discrepancies>
        </reconciliation_data>

        <risk_level_definitions>
        Assign risk level based ONLY on these thresholds — do not deviate:

        LOW:
        - Net difference is less than 1% of total listing amount
        - Missing invoices are less than 2% of total
        - No single discrepancy exceeds 5% of its invoice value

        MEDIUM:
        - Net difference is 1% to 3% of total listing amount
        - Missing invoices are 2% to 5% of total
        - Some discrepancies exceed 5% of invoice value but are explainable

        HIGH:
        - Net difference is 3% to 7% of total listing amount
        - Missing invoices are 5% to 10% of total
        - Multiple unexplained discrepancies present

        CRITICAL:
        - Net difference exceeds 7% of total listing amount
        - Missing invoices exceed 10% of total
        - Systematic or unexplained discrepancies suggesting fraud or control failure
        </risk_level_definitions>

        <materiality_definitions>
        Assess materiality based ONLY on these thresholds:

        IMMATERIAL: Net difference less than 1% of total listing amount
        MATERIAL: Net difference between 1% and 5% of total listing amount
        HIGHLY MATERIAL: Net difference exceeds 5% of total listing amount
        </materiality_definitions>

        <executive_summary_guidelines>
        Write exactly 2 to 3 paragraphs covering:
        - Paragraph 1: Overview of what was reconciled, total scope, and match rate
        - Paragraph 2: Nature and magnitude of discrepancies and missing items
        - Paragraph 3: Overall audit conclusion and urgency of follow-up action

        Rules:
        - Use only figures present in the input data
        - Do not speculate on causes unless directly supported by key_discrepancies
        - Use formal audit language
        - Do not repeat the same figure more than twice across the summary
        </executive_summary_guidelines>

        <recommendations_guidelines>
        Provide exactly 3 to 5 recommendations that are:
        - Specific and actionable, not generic
        - Directly tied to the discrepancies or missing invoices in the input
        - Prioritized by urgency (most urgent first)
        - Written as imperative sentences (e.g. "Investigate...", "Reconcile...", "Implement...")
        </recommendations_guidelines>

        <strict_constraints>
        - ONLY reference figures explicitly present in the reconciliation data
        - NEVER fabricate invoice numbers, vendor names, or amounts not in the input
        - NEVER assign a risk level outside the defined thresholds above
        - NEVER assign a materiality level outside the defined thresholds above
        - If key_discrepancies is empty or None, do not reference specific discrepancy details
        - All percentages you calculate must be derivable from the provided figures
        </strict_constraints>

        <self_check>
        Before responding, verify:
        1. Risk level matches the defined threshold for the calculated net difference percentage
        2. Materiality assessment matches the defined threshold
        3. Executive summary contains no figures not present in the input data
        4. Every recommendation references a specific finding from the input
        5. Output is raw JSON only with no markdown, no backticks, no explanation text
        </self_check>

        <output_schema>
        Return ONLY raw JSON matching this exact schema with no additional text:
        {{
            "executive_summary": "<exactly 2 to 3 paragraphs of formal audit summary>",
            "risk_level": "<Low|Medium|High|Critical>",
            "risk_justification": "<specific justification referencing input figures and which threshold was met>",
            "materiality_assessment": "<Immaterial|Material|Highly Material> with justification referencing input figures",
            "recommendations": [
                "<specific actionable recommendation 1 — most urgent>",
                "<specific actionable recommendation 2>",
                "<specific actionable recommendation 3>",
                "<specific actionable recommendation 4 — optional>",
                "<specific actionable recommendation 5 — optional>"
            ],
            "calculated_metrics": {{
                "match_rate_pct": <float>,
                "missing_rate_pct": <float>,
                "net_difference_pct": <float>
            }}
        }}
        </output_schema>"""

        chain = self.llm | self.json_parser

        try: 
            response = await chain.ainvoke([HumanMessage(content=prompt)])
            return response
        except ValueError as e1:
            logger.error(f"Value error in reconLLM.get_recon_summary. The error is:\n {e1}")
            raise 
        except google_exceptions.ResourceExhausted as e2:
            logger.error(f"Reconiliation api is exhausted")
            raise
        except google_exceptions.InvalidArgument as e3:
            logger.error("Bad prompt for get_recon_summary")
            raise
        except google_exceptions.GoogleAPIError as e4:
            logger.error(f"API Error in reconLLM_service.get_recon_summary. The error is {e4}")
            raise
        except Exception as err:
            logger.error(f"Error in reconLLM_service.get_recon_summary. The error is {err}")
            raise