# 06: Author the Module 8 content

**What to build:** Every question, prize, and line in the show exists and is correct. A Presenter can revise any of it — a question, a prize, a phrase — without touching a single component. The show stops being a demonstration with placeholder text and becomes the thing that teaches Module 8.

This ticket is authored in full from the Module 8 source, including a placeholder prize table, so it is never waiting on anyone. The presenters swap the prize strings for what they actually obtain.

**Blocked by:** 01 — Join the show. Can run in parallel with 02 through 05; it gates nothing.

**Status:** ready-for-agent

- [ ] The question bank covers all three Module 8 blocks — the importance of planning, the TRIM tools, and failure in entrepreneurship
- [ ] Separate pools exist for Cull questions and for bout questions, since the two need different difficulty profiles
- [ ] Later questions are weighted toward failure, so the finale pays off what the quiz set up
- [ ] Every question has exactly one correct answer, and a malformed question fails validation at build time rather than during the show
- [ ] The prize table is populated with realistic classroom placeholders: a small guaranteed voucher for Pera, a set of larger vouchers and snack or drink items, and Bokya
- [ ] Every on-screen line is Taglish — Filipino for the host's voice and the drama, English for the business terms
- [ ] Deck copy covers the five TRIM instruments in depth and the eight entrepreneurs — Socorro Ramos, John Gokongwei Jr., Tony Tan Caktiong, Henry Sy, Ramon del Rosario, Vince Ong, Dado Banatao, and Maria Ressa — with what each one failed at first
- [ ] A Presenter can change a question, a prize, or a line without touching any component, and the change is type-checked
- [ ] Placeholder prizes are clearly marked as placeholders, so nobody presents a voucher for something they do not have