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
        onJoin={show.join}
      />
    );
  }

  return (
    <Backbone state={show.state} joinUrl={show.joinUrl} connection={show.connection} onStartShow={show.startShow} />
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(<App />);