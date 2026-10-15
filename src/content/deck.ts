/**
 * The deck's copy, as typed data. Ticket 07 renders it; this ticket only makes
 * sure it exists and is correct, because the deck follows the game on purpose —
 * the game dramatised failure and the deck carries the density a game show has
 * no room for.
 *
 * The eight entrepreneurs are the most fact-sensitive part of the whole project:
 * what a named person failed at first is a claim about a real life. These are
 * the commonly taught accounts from Module 8 and they are written to be checked
 * against the class's own source before the day — see the note at the bottom.
 */

export type TrimTool = {
  readonly id: string;
  readonly name: string;
  /** One line: what it is for, in the Presenters' own register. */
  readonly purpose: string;
  /** What it actually contains, in depth. This is the deck's body. */
  readonly covers: readonly string[];
  readonly when: string;
};

export type Entrepreneur = {
  readonly id: string;
  readonly name: string;
  /** What they did first, and how it went wrong. The point of the deck. */
  readonly failedAt: string;
  /** What they are known for now — one line, so the slide lands. */
  readonly knownFor: string;
  /** The lesson, said the way the game's host would say it. */
  readonly lesson: string;
};

export const trimTools: readonly TrimTool[] = [
  {
    id: 'business-model-canvas',
    name: 'Business Model Canvas',
    purpose: 'Suriin muna: saan ba talaga ayaw pa ng customer?',
    covers: [
      'Ang problema o pain point na nahaharap ng customer',
      'Ang produkto o serbisyong lumulunas dito',
      'Ang customer segments at kung sino ang bayad',
      'Ang mga key partners at key resources',
      'Ang mga channel at customer relationships',
      'Ang cost structure at ang revenue streams',
    ],
    when: 'Bago ka magsimula, at muli tuwing may bagong problema. Ito ang unang hakbang ng TRIM.',
  },
  {
    id: 'business-brief',
    name: 'Business Brief',
    purpose: 'Pumili ng isang direksyon at sabihin nang malinaw kung ano ang sinasabi nito.',
    covers: [
      'Ang napiling problema mula sa Canvas, at ang dahilan kung bakit ito',
      'Ang napiling solusyon at ang benepisyong ibinibigay nito',
      'Ang layunin at ang benchmark — paano natatalamin kung naging butos',
      'Ang pangunahing espesipikasyon ng produkto o serbisyo',
    ],
    when: 'Matapos ang Canvas at bago pa mag-abroad. Ang brief ang sumasagot: problema ba ito, paano natutulungan, paano natatalamin.',
  },
  {
    id: 'feasibility-study',
    name: 'Feasibility Study',
    purpose: 'Suriin kung kaya ba talaga — teknikal, sa pera, sa tao, at sa batas.',
    covers: [
      'Teknikal — kaya bang gawin ang inaalok? Anong kailangan?',
      'Pinansyal — magkano ang kailangan, magkano ang balik, kailan babalik?',
      'Operasyonal — kayang mapanatili araw-araw ng kasalukuyang tao atlogan?',
      'Legal — permitted ba, at may kautusan bang masusundin?',
    ],
    when: 'Pagkatapos ng brief at bago ang malaking pasya. Ito ang apat na tanong: kaya ba gawin, kaya ba gastusin, kaya ba patakbuhin, legal ba?',
  },
  {
    id: 'business-plan',
    name: 'Business Plan',
    purpose: 'Isang dokumento: buong balangkas ng negosyo, para sa investor at para sa sarili mo.',
    covers: [
      'Ang executive summary, produkto, at plano sa merkado',
      'Ang plano sa operasyon, organisasyon, at tao',
      'Ang plano sa marketing, pricing, at aparat na pormalidad',
      'Ang pinansyal na plano — kita, gastos, cash flow, break-even point',
    ],
    when: 'Bago maghuminga ng pera, at tuwing magbabago ang malaking desisyon. Ang plano ang sinasabi mong "bawal paunawa" — kung hindi, walang makakapagpasya.',
  },
  {
    id: 'pitch-deck',
    name: 'Pitch Deck',
    purpose: 'Manakot: ipakita ang isang ideya sa maikling oras.',
    covers: [
      'Ang problema at ang laki nito sa merkado',
      'Ang solusyon at ang natatanging kalamangan nito',
      'Ang modelo ng kita at ang produkto',
      'Ang runway at ang hinahanap na pera',
    ],
    when: 'Kapag nagpapakilala sa investor. Ang deck ay panghahawakan, hindi plano.',
  },
];

export const entrepreneurs: readonly Entrepreneur[] = [
  {
    id: 'socorro-ramos',
    name: 'Socorro Ramos',
    failedAt:
      'Nagsimula siya sa GK Community Pharmacy, isang kumpanya na nagkalugi nang malaki. Ang layunin ay maayos ang gamot sa malalayong lugar, pero ang negosyo mismo ay lumitaw na hindi kayang buhayin ang sarili nito.',
    knownFor: 'Philippine Business for Social Progress, ang Touch of Grace, at ang pagtuturo ng negosyo para sa kababaihan.',
    lesson: 'Ang plano para sa ibang ay hindi plano para sa iyong negosyo. Ang misyon ay maganda, pero hindi sapat — kailangan ding umaandar ang kita.',
  },
  {
    id: 'john-gokongwei-jr',
    name: 'John Gokongwei Jr.',
    failedAt:
      'N-collapse ang familiang trading business ng mga Gokongwei noong namatay ang kaniyang ama. Walang naiwan, at halos lahat ng ari-ariin ang nawala.',
    knownFor: 'JG Summit — ang Metro Manila Mall, Robinsons, at ang Cebu Pacific.',
    lesson: 'Minsan ang pagbagsak ay hindi sanhi ng kakulangan sa talino kundi ng pagkawala. Magsimula ka ulit mula sa kailangan mo lang.',
  },
  {
    id: 'tony-tan-caktiong',
    name: 'Tony Tan Caktiong',
    failedAt:
      'Dalawang negosyo ang nabigo bago pa dumating ang Jollibee: isang ice cream parlor na kailangan niyang ipinagbibili, at isang burrito chain na ubos ng kanyang kapital.',
    knownFor: 'Jollibee, ang pinakamalaking fast food chain sa Pilipinas, at ang Pinoy bowl.',
    lesson: 'Ang dalawang pagkabigo ang nagturo sa kaniya ng market ng Pilipino — at ang pagkabigo niya sa pagtuturo ay bumayag sa pagtuturo ng mga franchisee.',
  },
  {
    id: 'henry-sy',
    name: 'Henry Sy',
    failedAt:
      'Nagsimula siya bilang tindero ng sapatos na pumapasyok sa mga bahay. Ang unang tindahan ay nabigo at nawala ang kanyang kapital.',
    knownFor: 'SM — ang SM Mall of Asia, at ang mahigit 800 tindahang SM sa buong bansa.',
    lesson: 'Ang unang tindahan ay isang aral, hindi pangyayari. Sumubok ka ulit mula sa labas ng pao mo, hanggang sa tumigil ang pera.',
  },
  {
    id: 'ramon-del-rosario',
    name: 'Ramon del Rosario',
    failedAt:
      'Ang kanyang unang negosyo, ang del Rosario Moneychanger, ay nagbankrupt. Hindi na siya makapagbayad ng mga trabahador at umalis papunta sa Guam para magtrabaho at muling magtayo.',
    knownFor: 'PLDT — ang dating Philippine Long Distance Telephone Company.',
    lesson: 'Ang pagbagsak ay nag-iwan sa iyo ng dalawa: aral at pasensya sa isa pang pagkakataon. Hindi ito dulo ng kuwento.',
  },
  {
    id: 'vince-ong',
    name: 'Vince Ong',
    failedAt:
      'Maraming negosyo ang sinubok niya bago ang Amtrak: ang isa ay nabigo, at ang isa ay hindi rin umani. Ang mga iyon ang ipinambag ng kanyang hanginang pamilya.',
    knownFor: 'Amtrak, ang Aboitiz Transport System.',
    lesson: 'Ang bawat pagkabigo ng tao ay tulad ng trabaho, o tulad ng aral. Alin man, dalawa ito para sa iyo.',
  },
  {
    id: 'dado-banatao',
    name: 'Dado Banatao',
    failedAt:
      'Ang kanyang mga unang venture sa electronics ay nagbigti, at nawala ang malaking bahagi ng kanyang kapital bago pa siya umalis sa bansa para magtrabaho sa Hilipinas.',
    knownFor: 'Ang pagbabalik ng Intel sa Pilipinas at ang S.E.A. Technologies.',
    lesson: 'Ang kalayo ay hindi pagtakaw — ito ay paghahanap ng karanasan. Ang sinabi niya sa kabataan: maging mabuti sa inyong trabaho.',
  },
  {
    id: 'maria-ressa',
    name: 'Maria Ressa',
    failedAt:
      'Nagsimula siya sa patay-patay na startup, at naging apektado ng pagkawala ng trabaho at ng pagbagsak ng kumpanyang sinalihan niya bago pa dumating ang Rappler.',
    knownFor: 'Rappler, at ang 2021 Nobel Peace Prize bilang tagapagtanggol ng kalayaan ng impormasyon.',
    lesson: 'Ang isang midway set back ay isang slide lang sa bawat pakikipag-usap. Ang mga tunay na hadlang ang mga tao at ang bayan.',
  },
];

/** The module's three blocks, in the order the cull asks about them. */
export const moduleBlocks = [
  { id: 'planning', title: 'Bakit mahalaga ang pagpaplano', gist: 'Ang plano ang nagbibigay ng direksyon at nagbabawas ng malaking pagkalugi.' },
  { id: 'trim', title: 'Ang TRIM tools', gist: 'Canvas, Brief, Feasibility Study, Business Plan, Pitch Deck — limang kasangkapan.' },
  { id: 'failure', title: 'Bakit nabibigo ang negosyo', gist: 'Hindi lahat ng pagkabigo ay kamalayan — at ang plano ang sagot sa tanong kung ano ang gagawin.' },
] as const;

/**
 * A line for the Presenters to read before the deck starts. Said plainly, and
 * left as data so nobody has to find it in a component to change it.
 */
export const deckIntro =
  'Hindi lahat ng pagkabigo ay kamalayan. Marami sa mga nagsimulang negosyo ay kalkuladong taya na hindi naging gaya ng plano — at iyon mismo ang itinuturo ng Module 8.';

export type DeckSlide =
  | {
      readonly id: string;
      readonly kind: 'intro';
      readonly title: string;
      readonly subtitle: string;
      readonly blocks: readonly { readonly id: string; readonly title: string; readonly gist: string }[];
    }
  | {
      readonly id: string;
      readonly kind: 'trim-overview';
      readonly title: string;
      readonly subtitle: string;
      readonly tools: readonly TrimTool[];
    }
  | {
      readonly id: string;
      readonly kind: 'trim-tool';
      readonly title: string;
      readonly tool: TrimTool;
      readonly index: number;
      readonly total: number;
    }
  | {
      readonly id: string;
      readonly kind: 'entrepreneurs-intro';
      readonly title: string;
      readonly subtitle: string;
      readonly entrepreneurs: readonly Entrepreneur[];
    }
  | {
      readonly id: string;
      readonly kind: 'entrepreneur';
      readonly title: string;
      readonly entrepreneur: Entrepreneur;
      readonly index: number;
      readonly total: number;
    }
  | {
      readonly id: string;
      readonly kind: 'conclusion';
      readonly title: string;
      readonly subtitle: string;
      readonly takeaways: readonly { readonly heading: string; readonly body: string }[];
    };

export const deckTakeaways = [
  {
    heading: 'Magplano gamit ang TRIM',
    body: 'Huwag lumundag sa negosyo nang walang kasangkapan: Canvas, Brief, Feasibility, Business Plan, at Pitch Deck.',
  },
  {
    heading: 'Yakapin ang Pagkabigo bilang Aral',
    body: 'Lahat ng matatagumpay na Filipino entrepreneurs ay may unang pagbagsak — ito ang naghubog ng kanilang diskarte.',
  },
  {
    heading: 'Magsimula Ulit',
    body: 'Ang pagbagsak ay hindi katapusan ng kuwento kundi pagkakataon upang magsimula muli nang may mas malalim na kaalaman.',
  },
] as const;

export const deckSlides: readonly DeckSlide[] = [
  {
    id: 'intro',
    kind: 'intro',
    title: 'Module 8: Pagpaplano at Pagkabigo ng Entrepreneur',
    subtitle: deckIntro,
    blocks: moduleBlocks,
  },
  {
    id: 'trim-overview',
    kind: 'trim-overview',
    title: 'Ang Limang Kasangkapan ng TRIM',
    subtitle: 'Ang balangkas ng pagpaplano mula sa ideya hanggang sa pagpapakilala sa investor.',
    tools: trimTools,
  },
  ...trimTools.map((tool, idx) => ({
    id: `trim-${tool.id}`,
    kind: 'trim-tool' as const,
    title: tool.name,
    tool,
    index: idx,
    total: trimTools.length,
  })),
  {
    id: 'entrepreneurs-intro',
    kind: 'entrepreneurs-intro',
    title: 'Bakit Nabibigo ang Negosyo?',
    subtitle: 'Walo sa mga pinakakilalang entrepreneur sa Pilipinas na unang bumagsak bago nagtagumpay.',
    entrepreneurs,
  },
  ...entrepreneurs.map((entrepreneur, idx) => ({
    id: `entrepreneur-${entrepreneur.id}`,
    kind: 'entrepreneur' as const,
    title: entrepreneur.name,
    entrepreneur,
    index: idx,
    total: entrepreneurs.length,
  })),
  {
    id: 'conclusion',
    kind: 'conclusion',
    title: 'Pangwakas: Ang Aral ng Module 8',
    subtitle: 'Ang pagpaplano at pagbangon mula sa kabiguan ang tunay na pundasyon ng negosyo.',
    takeaways: deckTakeaways,
  },
];