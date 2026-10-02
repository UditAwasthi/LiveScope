import { historicalPath } from './live';
import { useDashboard, type ServiceCard } from './store';

export function App() {
  const cards = useDashboard((state) => Object.values(state.cards));
  const alerts = useDashboard((state) => state.alerts);
  const health = useDashboard((state) => state.health);
  const divergence = useDashboard((state) => state.divergence);
  const seek = useDashboard((state) => state.seek);
  return (
    <main>
      <h1>LiveScope</h1>
      <ul>
        {alerts.map((alert) => (
          <li key={alert.id} role="alert">{alert.message}</li>
        ))}
      </ul>
      <section>
        {cards.map((card: ServiceCard) => (
          <article key={card.id}>
            <h2>{card.id}</h2>
            <p>{card.status}</p>
            <p>{card.latency}</p>
            <p>{card.errorRate}</p>
            <p>{card.rps}</p>
            <p>divergence {divergence[card.id] ?? 0}</p>
            <label>
              time-travel
              <input
                aria-label={`time-travel-${card.id}`}
                type="range"
                min={0}
                max={100}
                value={seek[card.id] ?? 100}
                onChange={(event) => {
                  useDashboard.getState().setSeek(card.id, Number(event.target.value));
                }}
              />
            </label>
            <p>{historicalPath(card.id, seek[card.id] ?? 100)}</p>
          </article>
        ))}
      </section>
      <section>
        {Object.entries(health).map(([name, ok]) => (
          <p key={name}>{name}: {ok ? 'up' : 'down'}</p>
        ))}
      </section>
    </main>
  );
}
