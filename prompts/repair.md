# Stage 6: bounded execution-validation repair

Input: canonical design, selected DBMS, generated schema/seed, exact isolated-engine execution error, and attempt number.
Output: a COMPLETE corrected canonical object matching design-contract.md. Repair the root cause in keys, types, checks, sample values, ordering, or dependency structure. Preserve domain requirements. Do not output raw executable SQL, disable foreign keys, remove necessary constraints just to pass, or claim success. If a repair changes the design, human approval will be invalidated and requested again. The application compiles corrected SQL and repeats real validation with a hard maximum; do not loop yourself.
