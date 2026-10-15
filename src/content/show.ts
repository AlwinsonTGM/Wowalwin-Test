// Every on-screen word and every number the show is configured with. No
// component may hardcode wording; if a Presenter wants different copy, this is
// the only file they touch (ticket 01: wording lives in content files).

export const showConfig = {
  /** Hard cap on Players. The roster stays legible on a projector up to here. */
  playerCap: 40,
  /** Longest name a Player may submit. */
  maxNameLength: 24,
  /** Where each surface lives. The Stage prints playerPath for the room. */
  backbonePath: '/',
  stagePath: '/stage',
  playerPath: '/play',
  /** Seconds rather than milliseconds: the Presenter reads these as the show's pace. */
  timings: {
    /** The answer window. The Backbone counts it down so the Presenter knows
     *  when to press the reveal, and the server closes it on its own. */
    answerSeconds: 10,
    /** How often the tick sounds while the answer window is open. */
    tickSeconds: 1,
    /** Suspense pause before bout reveal. */
    suspenseSeconds: 5,
    /** Time the winner is displayed before advancing. */
    winnerSeconds: 5,
  },
  /**
   * Where the presenters drop their audio files, relative to the site root.
   * Nothing ships here: a file that is missing or unreadable degrades to
   * silence and never blocks a transition, so a silent show is the default
   * and never a broken one.
   */
  audio: {
    tick: 'audio/tick.mp3',
    sting: 'audio/sting.mp3',
    reveal: 'audio/reveal.mp3',
    bokya: 'audio/bokya.mp3',
  },
  cull: {
    /** The cull stops here. Ten or fewer Players is the size of the bracket. */
    targetPlayers: 10,
    /** Warn the Presenter with this few questions left and the target unmet. */
    queueWarning: 2,
  },
  /** A seeded Player's id, so one is recognisable in the event log. */
  simulation: { idPrefix: 'sim-' },
} as const;

/**
 * The names a seeded roster is given. They are not Players, so they must not
 * look like Players either: these are the names a rehearsal grid is made of,
 * and the Backbone marks every one of them as simulated.
 */
export const simulatedNames = [
  'Ana',
  'Ben',
  'Cara',
  'Dan',
  'Elsa',
  'Frank',
  'Grace',
  'Hector',
  'Ivy',
  'Jonas',
  'Kara',
  'Luis',
  'Maya',
  'Nico',
  'Omar',
  'Petra',
  'Ramon',
  'Sofia',
  'Tina',
  'Vic',
] as const;

/** Seeded name number `index`, counted from zero, and never the same twice
 *  within a rehearsal even after the pool has been gone round. */
export const simulatedName = (index: number): string => {
  const name = simulatedNames[index % simulatedNames.length]!;
  const cycle = Math.floor(index / simulatedNames.length);
  return cycle === 0 ? name : `${name} ${cycle + 1}`;
};

/**
 * The question queue the show asks from moved to `questions.ts` in ticket 06,
 * which split the two pools the Cull and the Bracket draw from. This file keeps
 * the show's numbers, its paths and every word the surfaces read aloud; the
 * questions, the prizes and the deck copy live beside it in the same folder.
 */

export const copy = {
  showTitle: 'Wowolwin',
  segment: 'Pera o Kahon',

  /** ADR-0002: the room can only be reached if these two things are on screen. */
  common: {
    noAddress: 'Hindi mahanap ang tamang address. Buksan ang hotspot o i-off ang extrang Wi-Fi, saka i-restart.',
    firewallNote: 'Kung hindi makakapasok ang phone, i-check ang Windows Firewall para sa private network.',
    logUnreadable: (path: string) => `Hindi mabasa ang event log sa ${path}. Nawala ang dating roster.`,
    /** Said once, loudly, on a run that cannot touch the real show. */
    rehearsalWarning: 'REHEARSAL ito. Hindi nito nasasagot ang tunay na show.',
    rehearsalLog: 'rehearsal — walang epekto sa tunay na show',
    showLog: 'ang tunay na show',
  },

  backbone: {
    title: 'Backbone',
    status: {
      connecting: 'Kinokonekta…',
      online: 'Naka-connect',
      offline: 'Nawalan ng koneksyon',
    },
    rosterHeading: 'Roster',
    rosterEmpty: 'Wala pang nakakapasok. Ipakita ang link sa Stage para makapasok ang mga Players.',
    rosterCount: (joined: number) => `${joined} / ${showConfig.playerCap} Players`,
    rosterFull: 'Puno na ang roster. Hindi na makakapasok ang iba.',
    connection: {
      online: 'Nakakonekta',
      offline: 'Nawalan ng koneksyon',
    },
    rehearsalBadge: 'Rehearsal',
    showBadge: 'Tunay na Show',
    connectionHealth: (connected: number, total: number) => `${connected} / ${total} nakakonekta`,
    disconnectedAlert: (count: number) => `Babala: May ${count} Player na nawalan ng koneksyon!`,
    startShow: 'Simulan ang show',
    showStarted: 'Nagsimula na ang show. Hindi na makakapasok ang bago.',
    joinLinkHeading: 'Link para sa mga Players',

    /** The Presenter's side of one question. */
    controlHeading: 'Kontrol ng show',
    nothingPresented: 'Wala pang tinatanong. Pindutin ang button para magsimula.',
    presentQuestion: 'Ipakita ang tanong',
    reveal: 'Ipakita ang sagot',
    countdown: (seconds: number) => `${seconds} segundo bago maisasara ang sagot`,
    windowClosed: 'Sarado na ang pagsusagot. Puwede nang ituloy ang reveal.',
    answerHeading: 'Tamang sagot',
    cueHeading: 'Line para sa Presenter',
    submitted: (count: number) => `${count} ang nagsagot`,
    submittedNone: 'Walang nagsagot.',

    /** Submitting on behalf of a Player (ticket 08 fallback) */
    submitOnBehalfHeading: 'Sagutan para sa Player',
    submitOnBehalfPlayerLabel: 'Player',
    submitOnBehalfOptionLabel: 'Sagot',
    submitOnBehalfButton: 'Isumite ang sagot',

    /** Direct Bout Resolution (ticket 08 fallback) */
    directResolutionHeading: 'Direktang Resolusyon sa Bout',
    declareWinner: (name: string) => `Ideklara si ${name} bilang Panalo`,

    /** The cull's own numbers, on the Presenter's screen, at all times. */
    survivorsHeading: 'Nakalaan',
    survivors: (count: number) => `${count} ang nakalaan`,
    cullComplete: 'Tapos na ang cull. Ito na ang mga napili para sa bracket.',
    /**
     * Said when the cull finished with nobody in it. It is a state the machine
     * can reach — a round where nobody answered correctly empties the room —
     * and the usual "these are the ones for the bracket" is not merely wrong
     * there, it is an invitation to carry on into a bracket with no entrants.
     * What happens next is ticket 04's decision; this only refuses to pretend.
     */
    cullEmpty: 'Walang nakalaan. Walang makakapasok sa bracket.',
    queueSpent: 'Tapos na ang mga tanong at hindi pa naabot ang target ng nakalaan.',
    queueLow: (left: number) => `Konti na ang tanong: ${left} na lang. Maaaring hindi maabot ang target.`,

    /** A rehearsal room, seeded rather than joined (ticket 03). */
    simHeading: 'Simulated na Players',
    simulate: (count: number) => `Magdagdag ng ${count}`,
    clearSimulated: 'Alisin ang simulated',
    simNone: 'Walang simulated na Player.',
    simArm: 'Sasagot ang simulated kada tanong',
    simStop: 'Itigil ang simulated',
    simNow: 'Sagotan ngayon',
    simModeHeading: 'Paano nila sasagutin',
    simMode: {
      correct: 'Lahat tama',
      wrong: 'Lahat mali',
      mixed: 'Mixture',
    },
    simLocked: 'Hindi na maaaring baguhan ang roster kapag nagsimula na ang show.',
    simulatedBadge: 'Sim',

    /** Trim and Bracket controls (ticket 04) */
    trimHeading: 'Bawasan sa 8 ang nakalaan',
    trimInstruction: 'Pumili ng 8 Players na papasok sa bracket.',
    trimConfirm: 'Kumpirmahin ang 8 Players',
    trimCount: (selected: number) => `${selected} / 8 napili`,
    startBracket: 'Simulan ang Bracket',
    bracketHeading: 'Ang Bracket',
    currentBoutHeading: 'Kasalukuyang Bout',
    rerunBout: 'Ulitin ang bout',
    reverseElimination: 'Ibalik ang pagkakatanggal',
    confirmReverse: 'Kumpirmahin ang pagbalik',
    cancelReverse: 'Kanselahin',
    ambiguousRulesHeading: 'Patakaran sa Bout',
    ambiguousRules:
      'Patakaran: pinakamabilis na tamang sagot ang panalo. Kung parehong mali, ang unang sumagot ang tanggal at ang isa ang aabante. Kung walang sumagot, ulitin ang bout.',
    finalistHeading: 'Ang Finalist',
    rounds: {
      quarter: 'Quarterfinals',
      semi: 'Semifinals',
      final: 'Final',
    },

    /** Pera o Kahon finale controls (ticket 05) */
    startFinale: 'Simulan ang Pera o Kahon',
    finaleHeading: 'Pera o Kahon',
    choosePeraOnBehalf: 'Piliin ang Pera para sa Finalist',
    chooseKahonOnBehalf: 'Piliin ang Kahon para sa Finalist',
    revealKahon: 'Buksan ang Kahon',
    drawnPrizeReady: (label: string, value: string) => `Nasa Kahon: ${label} (${value}). Ihanda ang prop box bago buksan.`,
    peraWon: (label: string, value: string) => `Pinili ang Pera: ${label} (${value}).`,
    bokyaResult: 'Bokya ang kinalabasan.',
    wonResult: (label: string, value: string) => `Panalo: ${label} (${value})!`,
    placeholderWarning: 'Babala: Stand-in / placeholder pa ang mga premyo sa table.',

    /** The Deck safety net & presentation (ticket 07) */
    deckHeading: 'Ang Deck (Safety Net)',
    openDeck: 'Ipakita ang Deck sa Stage',
    closeDeck: 'Isara ang Deck at Bumalik sa Show',
    deckSafetyNetNote: 'Puwede buksan ang deck kahit anong oras bilang safety net o presentasyon.',
    deckActiveBadge: 'Naka-display ang Deck sa Stage',
    prevSlide: 'Nakaraang Slide',
    nextSlide: 'Susunod na Slide',
    jumpSlide: 'Lumipat ng Slide',
    slideNumber: (current: number, total: number) => `Slide ${current} / ${total}`,

    /** One control for every sound in the show. */
    mute: 'Patayin ang tunog',
    unmute: 'Buksan ang tunog',
    muted: 'Naka-mute ang tunog.',
    audioMissing: (file: string) => `Hindi marinig ang ${file}. Ilagay ang audio file para may tunog.`,
  },

  stage: {
    title: 'Wowolwin',
    joinHeading: 'Now ang mga Players',
    joinInstruction: 'Buksan ito sa phone mo, saka pumunta sa “Join the Show”',
    joinQrLabel: 'QR code para sa Join URL',
    rosterHeading: 'Nakapasok na Players',
    rosterEmpty: 'Hintayin natin ang mga Players…',
    rosterCount: (joined: number) => `${joined} ang naka-join`,
    questionNumber: (asked: number) => `Tanong ${asked}`,
    secondsLeft: (seconds: number) => `${seconds} segundo`,
    waiting: 'Hintayin…',
    answerHeading: 'Ang sagot',
    survived: 'Nakalaan',
    eliminated: 'Tapos na',
    bracketHeading: 'Ang Bracket',
    boutHeading: (round: string) => `Bout: ${round}`,
    vs: 'laban kay',
    winner: (name: string) => `Panalo: ${name}!`,
    tieNoSubmissions: 'Walang sumagot! Uulitin ang bout.',
    finalist: (name: string) => `Ang Finalist: ${name}!`,
    rounds: {
      quarter: 'Quarterfinals',
      semi: 'Semifinals',
      final: 'Final',
    },

    /** Pera o Kahon finale (ticket 05) */
    finaleHeading: 'Pera o Kahon',
    finalistPrompt: (name: string) => `${name}, ano ang pipiliin mo: Pera o Kahon?`,
    peraOption: (value: string) => `Pera (${value} voucher)`,
    kahonOption: 'Mahiwagang Kahon',
    kahonChosen: (name: string) => `Pinili ni ${name} ang Kahon!`,
    peraChosen: (name: string) => `Pinili ni ${name} ang Pera!`,
    kahonOpening: 'Binubuksan ang Kahon…',
    wonPrize: (label: string, value: string) => `Panalo: ${label} (${value})!`,
    wonBokya: 'Bokya! Walang napanalunang premyo.',
    placeholderWarning: 'Paalala: Stand-in / placeholder pa ang mga premyo.',

    /** The Deck slides (ticket 07) */
    deckBadge: 'Module 8 Presentasyon',
    slideCounter: (current: number, total: number) => `Slide ${current} / ${total}`,
    trimToolBadge: (current: number, total: number) => `TRIM ${current} ng ${total}`,
    trimPurposeHeading: 'Layunin:',
    trimCoversHeading: 'Mga Saklaw (In-depth):',
    trimWhenHeading: 'Kailan Ginagamit:',
    entrepreneurBadge: (current: number, total: number) => `Entrepreneur ${current} ng ${total}`,
    entrepreneurFailedHeading: 'Unang Pagkabigo:',
    entrepreneurKnownHeading: 'Kilala Ngayon Sa:',
    entrepreneurLessonHeading: 'Aral:',
    conclusionHeading: 'Mga Pangunahing Aral:',
  },

  player: {
    title: 'Wowolwin',
    prompt: 'Ano ang pangalan mo?',
    namePlaceholder: 'Isulat ang iyong pangalan',
    joinButton: 'Pasok',
    nameRequired: 'Lagyan ng pangalan bago magpasok.',
    nameTooLong: (max: number) => `Masyadong mahaba ang pangalan. ${max} characters ang limit.`,
    joined: (name: string) => `Pasok ka na, ${name}!`,
    joinedCount: (joined: number) => `${joined} ang naka-join`,
    waitingForShow: 'Naghihintay ng simula ng show…',
    reconnecting: 'Nag-reconnect…',
    refused: {
      rosterFull: 'Puno na ang roster. Hindi ka na makakapasok.',
      showStarted: 'Nagsimula na ang show. Hindi ka na makakapasok, pero manood ka lang.',
    },

    /** The question on the phone. The phone answers and nothing else. */
    chooseAnswer: 'Pumili ng sagot',
    secondsLeft: (seconds: number) => `${seconds}s`,
    windowClosed: 'Sarado na ang pagsusagot.',
    waitingForReveal: 'Naghihintay ng reveal…',
    /** The show's answer to a submission, in the Player's own words. */
    answer: {
      recorded: 'Naisulat na ang sagot mo.',
      alreadyAnswered: 'Sagot mo na ito. Isang sagot lang kada tanong.',
      windowClosed: 'Sarado na ang pagsusagot.',
      notPlaying: 'Hindi ka naka-play sa tanong na ito.',
      notAnOption: 'Hindi wasto ang piniling sagot.',
    },
    /** Said once, on the phone that it happened to, and then it keeps working. */
    eliminated: 'Tapos na ang laban mo. Manood ka lang.',
    waitingForTurn: 'Naghihintay ng iyong laban…',
    boutWon: 'Panalo ka sa bout! Pasok ka sa susunod na laban.',
    boutLost: 'Talo ka sa bout. Tapos na ang laban mo.',

    /** Pera o Kahon finale (ticket 05) */
    finalePrompt: 'Pera o Kahon? Pumili sa ibaba:',
    peraButton: (value: string) => `Pera (${value})`,
    kahonButton: 'Kahon',
    peraSelected: 'Pinili mo ang Pera!',
    kahonSelected: 'Pinili mo ang Kahon! Hintayin ang pagbukas sa Stage…',
    finalistResult: (label: string, value: string) => `Napanalunan mo: ${label} (${value})!`,
    finalistBokya: 'Bokya! Walang napanalunan.',
    notFinalist: 'Manood sa Stage para sa Pera o Kahon!',

    /** The Deck (ticket 07) */
    deckActive: 'Tumingin sa Stage para sa presentasyon ng Module 8.',
  },
} as const;