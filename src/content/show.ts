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
} as const;

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
  },

  stage: {
    title: 'Wowolwin',
    joinHeading: 'Now ang mga Players',
    joinInstruction: 'Buksan ito sa phone mo, saka pumunta sa “Join the Show”',
    rosterHeading: 'Nakapasok na Players',
    rosterEmpty: 'Hintayin natin ang mga Players…',
    rosterCount: (joined: number) => `${joined} ang naka-join`,
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
  },
} as const;