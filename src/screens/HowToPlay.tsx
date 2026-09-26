const STEPS = [
  { title: 'Read the numbers', text: 'Each number is a run of filled squares in that row or column, in order, with at least one gap between runs.' },
  { title: 'Fill', text: 'Tap a square to fill it. Drag to fill a line of them. Tap again to clear.' },
  { title: 'Cross', text: "Switch to Cross to mark squares you know are empty. They're only notes." },
  { title: 'Solve', text: 'When every row and column matches its numbers, the picture is done.' },
];

export function HowToPlay() {
  return (
    <main className="screen with-tabs">
      <header className="page-head">
        <div>
          <p className="micro">Guide</p>
          <h1>How to play</h1>
        </div>
      </header>

      <section className="glass card-pad">
        <p className="lead">Fill in squares so every row and column matches the numbers beside it.</p>
        <ol className="steps">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <span className="step-number">{i + 1}</span>
              <span>
                <strong>{step.title}</strong>
                <span className="note">{step.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="glass card-pad">
        <p className="micro">No guessing</p>
        <p className="body-text">
          Every puzzle can be solved one row or column at a time, by logic alone, and has exactly one answer. Start with the
          big numbers: a 4 in a row of 5 always fills the middle three.
        </p>
      </section>

      <section className="glass card-pad">
        <p className="micro">Learn your book</p>
        <p className="body-text">
          Add lines you highlighted under Books. After each level, one comes back with a word missing: pick the right word to
          open the next level. A wrong pick just greys out, so try again. Lines you get first time come back after longer and
          longer gaps, and ones you miss come back soon, so the lines you keep forgetting come up most. Your highlights stay on
          your phone.
        </p>
      </section>

      <section className="glass card-pad">
        <p className="micro">Made for the train</p>
        <p className="body-text">
          Everything works with one thumb and without sound. There's no clock and no way to lose, and every tap is saved, so
          you can close the app at your stop and carry on later, even without a signal. Levels go on forever and grow from
          5×5 to 10×10. The daily puzzle is the same for everyone and resets at 00:00 UTC.
        </p>
      </section>
    </main>
  );
}
