/**
 * Every question the show can ask, as typed data. Nothing here is code the
 * Presenters have to read: change a word, change an answer, add a question.
 *
 * The bank is two pools because the two jobs want opposite things. A Cull
 * question is judged against a whole room of up to forty, so it has to be one
 * most people can answer — otherwise it empties the room in a single round. A
 * bout question is judged against one person in ten seconds, so it can afford
 * to be sharper. Ticket 04 draws the second pool.
 */

export type Option = {
  readonly id: string;
  readonly label: string;
};

export type Question = {
  readonly id: string;
  readonly prompt: string;
  readonly options: readonly Option[];
  /** Must be one of this question's own option ids. `check.ts` enforces it. */
  readonly correctOptionId: string;
  /** The Presenter's line, on the Backbone only (ADR-0003). */
  readonly cue: string;
};

/** Four options, because a show question with three is visibly a trick. */
export const OPTIONS_PER_QUESTION = 4;

/**
 * The Cull pool, easiest first.
 *
 * Order matters twice over. The show asks these in sequence, and the later ones
 * are deliberately about failure: the cull has to land under ten survivors, and
 * so does the finale have to be paid off by what the quiz set up. A Presenter
 * who wants a longer cull moves an easier question later, not out — the pool is
 * the difficulty dial.
 */
export const cullQuestions = [
  {
    id: 'c1-bakit-magplano',
    prompt: 'Bakit mahalaga ang pagpaplano bago magpasya?',
    options: [
      { id: 'a', label: 'Dahil masyadong maaasahan ang dating hula' },
      { id: 'b', label: 'Dahil nagbibigay ito ng direksyon at sinusuri ang mangyayari' },
      { id: 'c', label: 'Dahil hinihingi ito ng bangko' },
      { id: 'd', label: 'Dahil ginagawa ito ng halos lahat ng matagumpay na negosyo' },
    ],
    correctOptionId: 'b',
    cue: 'Ipakita kung magkano: ang plano ang nagbabawas ng malaking pagkalugi kapag mali ang pasya.',
  },
  {
    id: 'c2-magkano-plano',
    prompt: 'Ilang plano ang kailangan ng isang negosyo?',
    options: [
      { id: 'a', label: 'Isa lang, at iyon ang pinakamahalaga' },
      { id: 'b', label: 'Wala — basta may plano na, tuloy na' },
      { id: 'c', label: 'Maraming plano, at pinipili ang pinakaangkop sa bawat problema' },
      { id: 'd', label: 'Isang plano bawat taon lamang' },
    ],
    correctOptionId: 'c',
    cue: 'Ang plano ay proseso, hindi produkto. Isa lang ang tanging plano — ang business plan — pero may iba pa.',
  },
  {
    id: 'c3-trim-unang-hakbang',
    prompt: 'Sa TRIM, alin ang unang hakbang bago pa mag-isip ng solusyon?',
    options: [
      { id: 'a', label: 'Ang Pitch Deck' },
      { id: 'b', label: 'Ang Business Plan' },
      { id: 'c', label: 'Ang Business Model Canvas' },
      { id: 'd', label: 'Ang Feasibility Study' },
    ],
    correctOptionId: 'c',
    cue: 'Ang Canvas ang didiagnosis muna: hanapin muna kung saan ayaw pa ng customer.',
  },
  {
    id: 'c4-trim-pagkakasunod',
    prompt: 'Pagkatapos ng Business Model Canvas, ano ang susunod sa TRIM?',
    options: [
      { id: 'a', label: 'Ang Business Brief' },
      { id: 'b', label: 'Ang Pitch Deck' },
      { id: 'c', label: 'Wala — doon na natatapos ang TRIM' },
      { id: 'd', label: 'Ang Feasibility Study' },
    ],
    correctOptionId: 'a',
    cue: 'Canvas → Brief → Feasibility → Business Plan → Pitch Deck. Ito ang pagkakasunod ng TRIM.',
  },
  {
    id: 'c5-kasalanin-brief',
    prompt: 'Ano ang pinakamakalag na kalagayan ng isang business brief?',
    options: [
      { id: 'a', label: 'Malaking kompanya na hindi pa nakaipagana' },
      { id: 'b', label: 'Maliit at malinaw na negosyo na kaya nang patakbuhin nang episyente at epektibong resulta' },
      { id: 'c', label: 'Negosyong may napakaraming tauhan' },
      { id: 'd', label: 'Negosyong walang pumapasok na pera' },
    ],
    correctOptionId: 'b',
    cue: 'Ang maliit at malinaw — kaya pa itong patakbuhin nang episyente at epektibong resulta.',
  },
  {
    id: 'c6-pagkabigo-hula',
    prompt: 'Ano ang pinakamaliit na hadlang sa pagtatalo ng isang negosyo?',
    options: [
      { id: 'a', label: 'Ang labanan sa presyo' },
      { id: 'b', label: 'Ang kawalan ng kapital' },
      { id: 'c', label: 'Ang mga hindi inaasahang pangyayari — lindol, baha, sakit, bagong batas' },
      { id: 'd', label: 'Ang mahirap na makahanap ng manggagawa' },
    ],
    correctOptionId: 'c',
    cue: 'Ito ang dahilan kung bakit dapat may kapalit: ang hindi inaasahan ay hindi basta pinapansin.',
  },
  {
    id: 'c7-plano-kapag-bumigo',
    prompt: 'Bakit mahalaga pa rin ang plano kapag may nangyaring hindi inaasahan?',
    options: [
      { id: 'a', label: 'Dahil pinipigilan nito ang lindol at baha' },
      { id: 'b', label: 'Dahil sinasabi nito kung ano ang gagawin, sino ang gagawa, at kailan' },
      { id: 'c', label: 'Dahil nagbibigay ito ng pera' },
      { id: 'd', label: 'Dahil kinakailangan ito ng gobyerno' },
    ],
    correctOptionId: 'b',
    cue: 'Ang plano ang tumuturo sa pagkilos: ano, sino, kailan. Walang plano, walang alam kung ano ang gagawin.',
  },
  {
    id: 'c8-matumbo-matugunan',
    prompt: 'Paano natukoy kung matutong matugunan ang isang negosyo?',
    options: [
      { id: 'a', label: 'Kapag laging may lugit na makatipid sa sahod' },
      { id: 'b', label: 'Kapag malaking agwat na ang plano at ang totoong resulta sa loob ng ilang buwan' },
      { id: 'c', label: 'Kapag wala nang pumapasok na customer' },
      { id: 'd', label: 'Kapag maliit na lang ang kita' },
    ],
    correctOptionId: 'b',
    cue: 'Ang tanong: ano ang sinasabi ng numero laban sa plano? Malaking agwat, paulit-ulit — yan ang babala.',
  },
  {
    id: 'c9-mapositive-sa-market',
    prompt: 'May plano ang negosyo pero iba ang sinasabi ng market. Ano ang una?',
    options: [
      { id: 'a', label: 'Biglan magpalit ng produkto' },
      { id: 'b', label: 'Tukoyin kung sa loob o sa labas ng negosyo ang problema, at ayusin ang nasa loob' },
      { id: 'c', label: 'Hintaying maganda ang panahon' },
      { id: 'd', label: 'Itapon ang buong plano' },
    ],
    correctOptionId: 'b',
    cue: 'Tukoyin muna: internal ba o external? Ang nasa loob natin ang kayang ayusin.',
  },
  {
    id: 'c10-paano-magkatuto',
    prompt: 'Paano natututo ang isang negosyante mula sa pagkalugi?',
    options: [
      { id: 'a', label: 'Hinahabol niya ulit ang dating plano nang walang pagbabago' },
      { id: 'b', label: 'Sinusuri niya kung saan nagkamali, inaayos, at subok-ulit niya' },
      { id: 'c', label: 'Lumalabas siya sa negosyo agad' },
      { id: 'd', label: 'Naghahanap siya ng ibang negosyo para paglaruan' },
    ],
    correctOptionId: 'b',
    cue: 'Dito nagsisimula ang failure section: suriin, ayusin, subukan ulit. Iyon ang sinasabi ng module.',
  },
] as const satisfies readonly Question[];

/**
 * The bout pool: one question, two Players, ten seconds.
 *
 * Sharper than the Cull pool on purpose. A Cull question wants to be answered;
 * a bout question wants the faster Player to have had to think. This one is
 * read by ticket 04 and is not drawn from yet.
 */
export const boutQuestions = [
  {
    id: 'b1-trim-ugtong',
    prompt: 'Alin ang tamang pagkakasunod ng TRIM?',
    options: [
      { id: 'a', label: 'Business Plan → Brief → Model Canvas → Feasibility → Pitch Deck' },
      { id: 'b', label: 'Model Canvas → Brief → Feasibility → Business Plan → Pitch Deck' },
      { id: 'c', label: 'Feasibility → Model Canvas → Brief → Business Plan → Pitch Deck' },
      { id: 'd', label: 'Brief → Model Canvas → Business Plan → Pitch Deck → Feasibility' },
    ],
    correctOptionId: 'b',
    cue: 'Canvas (pagsusuri) → Brief (pagtutok) → Feasibility (kakasigurado) → Business Plan (kabuuan) → Pitch Deck (pagpapakilala).',
  },
  {
    id: 'b2-canvas-wala',
    prompt: 'Alin ang kailangan ng business model canvas na wala sa ibang kasangkapan?',
    options: [
      { id: 'a', label: 'Ang problema ng customer at ang produkto o serbisyong lumulunas dito' },
      { id: 'b', label: 'Ang buong plano sa loob ng limang taon' },
      { id: 'c', label: 'Ang presyong dapat ipakita sa investor' },
      { id: 'd', label: 'Ang pangalan ng kumpanya' },
    ],
    correctOptionId: 'a',
    cue: 'Iyan ang puso ng Canvas: problema at solusyon. Walang iba rito — dito nagsisimula ang lahat.',
  },
  {
    id: 'b3-brief-kusang',
    prompt: 'Ano ang tunay na layunin ng business brief?',
    options: [
      { id: 'a', label: 'Paglaruan kung saan nagkamali ang dating plano' },
      { id: 'b', label: 'Tukoyin ang problema at ang solusyong pipiliin, kasama ang layunin at benchmark' },
      { id: 'c', label: 'Kumuha ng malaking kontrata mula sa gobyerno' },
      { id: 'd', label: 'Huwag nang magpakilala sa sinuman' },
    ],
    correctOptionId: 'b',
    cue: 'Ang brief ang sumasagot sa: problema ba ito, paano natutulungan, at paano natatalamin kung naging butos.',
  },
  {
    id: 'b4-feasibility-legal',
    prompt: 'Alin sa TRIM ang sumusuri kung legal ang proyekto?',
    options: [
      { id: 'a', label: 'Ang Business Model Canvas' },
      { id: 'b', label: 'Ang Pitch Deck' },
      { id: 'c', label: 'Ang Feasibility Study' },
      { id: 'd', label: 'Ang Business Brief' },
    ],
    correctOptionId: 'c',
    cue: 'Teknikal, pinansyal, operasyonal, legal — lahat iyon ang tinatasa ng feasibility study.',
  },
  {
    id: 'b5-pitch-deck',
    prompt: 'Kailan ginagamit ang pitch deck?',
    options: [
      { id: 'a', label: 'Kapag kailangan ng pera o naniniwala ang investor sa ideya' },
      { id: 'b', label: 'Bawat araw, para makasundo ang mga manggagawa' },
      { id: 'c', label: 'Kapag nasira ang kalkulasyon sa gastos' },
      { id: 'd', label: 'Upang makapaglista ng produkto sa tindahan' },
    ],
    correctOptionId: 'a',
    cue: 'Ang deck ay panghahawakan, hindi plano. Ito ang sinasabi mo sa isang investor sa isang pulong.',
  },
  {
    id: 'b6-pinansyal',
    prompt: 'Alin sa feasibility study ang tinatasa kung kayang gastusin ang proyekto?',
    options: [
      { id: 'a', label: 'Ang teknikal na bahagi' },
      { id: 'b', label: 'Ang pinansyal na bahagi' },
      { id: 'c', label: 'Ang legal na bahagi' },
      { id: 'd', label: 'Ang operasyonal na bahagi' },
    ],
    correctOptionId: 'b',
    cue: 'Apat na tanong ng feasibility: kaya ba gawin, kaya ba gastusin, kaya ba patakbuhin, legal ba?',
  },
  {
    id: 'b7-bawal-paunawa',
    prompt: 'Sa isang business plan, bakit pinipigilan ang "bawal paunawa" na mangyari?',
    options: [
      { id: 'a', label: 'Dahil laban ito sa batas' },
      { id: 'b', label: 'Dahil kapag hindi natutukoy ang problema, walang makakapagpasya nang wasto' },
      { id: 'c', label: 'Dahil masyadong mahirap ibigkas sa board meeting' },
      { id: 'd', label: 'Dahil nanggagalawan ng kuwenterya ang investor' },
    ],
    correctOptionId: 'b',
    cue: 'Ang maliit at malinaw — kaya pa itong patakbuhin nang episyente at epektibong resulta.',
  },
  {
    id: 'b8-eksaktong-barya',
    prompt: 'Ano ang pinakamalaking problema ng isang maliit na negosyo sa Pilipinas?',
    options: [
      { id: 'a', label: 'Kakulangan sa kapital' },
      { id: 'b', label: 'Kakulangan sa kuryente' },
      { id: 'c', label: 'Sobrang dami ng nakikipagkumpitensya' },
      { id: 'd', label: 'Walang kapangyarihan ang may-ari' },
    ],
    correctOptionId: 'a',
    cue: 'Pinansyal na problema muna ito: walang pumapasok na pera pang-araw-araw. Kaya nga may venture capital.',
  },
  {
    id: 'b9-venture-capital',
    prompt: 'Bakit may venture capital sa isang negosyo?',
    options: [
      { id: 'a', label: 'Para makabili ng paboritong logo' },
      { id: 'b', label: 'Para makapagsimula o lumago nang walang nangangailangan na kita pa' },
      { id: 'c', label: 'Para mailigtas mula sa taning na walang makakapasok' },
      { id: 'd', label: 'Para agad maging paborito ng gobyerno' },
    ],
    correctOptionId: 'b',
    cue: 'Pera bago may kita. Iyon ang tanong ng isang investor: kaya bang lumago nang wala pang kita?',
  },
  {
    id: 'b10-sinusuri',
    prompt: 'Ano ang sinusuri ng negosyante kapag sinasabi niyang "matutong matugunan" ang negosyo?',
    options: [
      { id: 'a', label: 'Ang pagkakaiba ng plano at ang totoong resulta' },
      { id: 'b', label: 'Ang dami ng naghihiwalay na espasyo' },
      { id: 'c', label: 'Ang edad ng may-ari' },
      { id: 'd', label: 'Ang haba ng pangalan ng kumpanya' },
    ],
    correctOptionId: 'a',
    cue: 'Kung malaki ang agwat nang paulit-ulit, hindi na ito plano ng maling pananaw — iba na ito negosyo.',
  },
] as const satisfies readonly Question[];

/**
 * The two pools by name. The machine names one rather than searching every
 * list, which is what makes them separate pools rather than one list with a
 * comment on it.
 */
export const questionPools = { cull: cullQuestions, bout: boutQuestions } as const;

export type PoolName = keyof typeof questionPools;

export const questionsIn = (pool: PoolName): readonly Question[] => questionPools[pool];

/** Every question in the show, in one list, for ids and validation. */
export const allQuestions: readonly Question[] = [...cullQuestions, ...boutQuestions];

export const findQuestion = (id: string): Question | undefined =>
  allQuestions.find((candidate) => candidate.id === id);

/**
 * What only the Backbone may show: the correct option's wording and the
 * Presenter's line. ADR-0003 puts the answer in the server's hands and the
 * *when* in the Presenters', so this is read from the content file on the
 * presenter's own laptop and never travels over a socket before the reveal.
 */
export const forPresenter = (questionId: string): { answer: string; cue: string } | null => {
  const question = findQuestion(questionId);
  const correct = question?.options.find((option) => option.id === question.correctOptionId);
  if (!question || !correct) return null;

  return { answer: correct.label, cue: question.cue };
};

/**
 * Everything wrong with a question, in words a Presenter can act on. Types catch
 * a missing field; they cannot catch a repeated id, an empty label, or an answer
 * key pointing at an option that is not there — and the second kind is the one
 * that ends a question with nobody able to answer it. Run at build time by
 * `npm run content:check`, and again in the test suite.
 */
export function questionProblems(question: Question, pool: PoolName, seenIds: Set<string>): string[] {
  const problems: string[] = [];
  const where = `${pool}/${question.id || '(no id)'}`;

  if (!question.id) problems.push(`${where}: has no id`);
  else if (seenIds.has(question.id)) problems.push(`${where}: id is already used by another question`);
  if (!question.prompt.trim()) problems.push(`${where}: prompt is empty`);
  if (!question.cue.trim()) problems.push(`${where}: has no Presenter cue`);

  if (question.options.length !== OPTIONS_PER_QUESTION) {
    problems.push(`${where}: has ${question.options.length} options, expected ${OPTIONS_PER_QUESTION}`);
  }

  const optionIds = new Set(question.options.map((option) => option.id));
  if (optionIds.size !== question.options.length) problems.push(`${where}: two options share an id`);
  if ([...optionIds].some((id) => !id.trim())) problems.push(`${where}: an option has an empty id`);
  if (question.options.some((option) => !option.label.trim())) problems.push(`${where}: an option has no wording`);

  // The one that matters on the day: a question nobody can answer empties the room.
  if (!optionIds.has(question.correctOptionId)) {
    problems.push(`${where}: the answer key "${question.correctOptionId}" is not one of its options`);
  }

  return problems;
}

/** The same, over the whole show. Empty means the bank is sound. */
export function bankProblems(): string[] {
  const seenIds = new Set<string>();
  const problems: string[] = [];

  // One pass, because ids name a question in the event log and so have to be
  // unique across *both* pools — not merely inside their own.
  for (const pool of Object.keys(questionPools) as PoolName[]) {
    for (const question of questionPools[pool]) {
      problems.push(...questionProblems(question, pool, seenIds));
      seenIds.add(question.id);
    }
  }

  return problems;
}