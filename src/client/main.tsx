import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { copy } from '../content/show.ts';
import { Backbone } from './Backbone.tsx';
import { Stage } from './Stage.tsx';
import { Player } from './Player.tsx';
import { useShow } from './useShow.ts';
import { surfaceFor } from './surface.ts';
import './styles.css';

function App() {
  const show = useShow();
  const surface = surfaceFor(location.pathname);

  useEffect(() => {
    document.title = copy.showTitle;
  }, []);

  if (surface === 'stage') return <Stage state={show.state} joinUrl={show.joinUrl} />;

  if (surface === 'player') {
    return (
      <Player
        state={show.state}
        me={show.me}
        refusal={show.refusal}
        complaint={show.complaint}
        connection={show.connection}
        answerNote={show.answerNote}
        onJoin={show.join}
        onSubmitAnswer={show.submitAnswer}
        onChoosePera={show.choosePera}
        onChooseKahon={show.chooseKahon}
      />
    );
  }

  return (
    <Backbone
      state={show.state}
      joinUrl={show.joinUrl}
      connection={show.connection}
      onStartShow={show.startShow}
      onPresentQuestion={show.presentQuestion}
      onReveal={show.reveal}
      onSimulate={show.simulate}
      onClearSimulated={show.clearSimulated}
      onSimulateAnswers={show.simulateAnswers}
      onSetSimulation={show.setSimulation}
      onTrimCull={show.trimCull}
      onSeedBracket={show.seedBracket}
      onRerunBout={show.rerunBout}
      onReverseElimination={show.reverseElimination}
      onStartFinale={show.startFinale}
      onChoosePera={show.choosePera}
      onChooseKahon={show.chooseKahon}
      onRevealKahon={show.revealKahon}
      onOpenDeck={show.openDeck}
      onCloseDeck={show.closeDeck}
      onSetDeckSlide={show.setDeckSlide}
      onNextDeckSlide={show.nextDeckSlide}
      onPrevDeckSlide={show.prevDeckSlide}
      isRehearsal={show.isRehearsal}
      onSubmitAnswerOnBehalf={(playerId, optionId) => show.submitAnswer(optionId, playerId)}
      onResolveBoutDirectly={show.resolveBoutDirectly}
    />
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(<App />);