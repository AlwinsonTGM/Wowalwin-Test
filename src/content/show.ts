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

export type QuestionOption = { id: string; label: string };

export type Question = {
  id: string;
  prompt: string;
  options: QuestionOption[];
  /**
   * The option the machine grades as correct. ADR-0003: it is never broadcast
   * before the Presenter reveals, so it must not appear in any state a socket
   * carries.
   */
  correctOptionId: string;
  /** The Presenter's line. The Backbone shows it and no other surface does. */
  cue: string;
};

/**
 * The question queue the show asks from, in order. Two questions are here so
 * the queue can be seen to advance; ticket 06 fills out the Module 8 bank.
 */
export const questionBank: Question[] = [
  {
    id: 'q1-pagpaplano',
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
    id: 'q2-pagkabigo',
    prompt: 'Ayos pa ang plano ng isang negosyante, namatay din siya. Ano ang sinasabi nito?',
    options: [
      { id: 'a', label: 'Mali talaga ang plano' },
      { id: 'b', label: 'Walang plano talaga ang negosyante' },
      { id: 'c', label: 'May plano, pero may bagay na wala sa kamay niya' },
      { id: 'd', label: 'Kailangan pa lang palaging ng dagdag na plano' },
    ],
    correctOptionId: 'c',
    cue: 'Dito nagsisimula ang failure: hindi lahat ng pagkabigo ay pagkakamali — marami ay kalkuladong taya na hindi naging gaya ng plano.',
  },
];

/**
 * What only the Backbone may show: the correct option's wording and the
 * Presenter's line. ADR-0003 puts the answer in the server's hands and the
 * *when* in the Presenters', so this is read from the content file on the
 * presenter's own laptop and never travels over a socket before the reveal.
 */
export const forPresenter = (questionId: string): { answer: string; cue: string } | null => {
  const question = questionBank.find((candidate) => candidate.id === questionId);
  const correct = question?.options.find((option) => option.id === question.correctOptionId);
  if (!question || !correct) return null;

  return { answer: correct.label, cue: question.cue };
};

export const copy = {
  showTitle: 'Wowolwin',
  segment: 'Pera o Kahon',

  /** ADR-0002: the room can only be reached if these two things are on screen. */
  common: {
    noAddress: 'Hindi mahanap ang tamang address. Buksan ang hotspot o i-off ang extrang Wi-Fi, saka i-restart.',
    firewallNote: 'Kung hindi makakapasok ang phone, i-check ang Windows Firewall para sa private network.',
    logUnreadable: (path: string) => `Hindi mabasa ang event log sa ${path}. Nawala ang dating roster.`,
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

    /** The cull's own numbers, on the Presenter's screen, at all times. */
    survivorsHeading: 'Nakalaan',
    survivors: (count: number) => `${count} ang nakalaan`,
    cullComplete: 'Tapos na ang cull. Ito na ang mga napili para sa bracket.',
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
    rosterHeading: 'Nakapasok na Players',
    rosterEmpty: 'Hintayin natin ang mga Players…',
    rosterCount: (joined: number) => `${joined} ang naka-join`,
    questionNumber: (asked: number) => `Tanong ${asked}`,
    secondsLeft: (seconds: number) => `${seconds} segundo`,
    waiting: 'Hintayin…',
    answerHeading: 'Ang sagot',
    survived: 'Nakalaan',
    eliminated: 'Tapos na',
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
  },
} as const;