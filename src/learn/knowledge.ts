// Short ideas worth knowing, one shown after each puzzle: long enough to be useful, short
// enough to read before the next stop. Written in our own words. Each names where the
// idea comes from, and hedges where the research is weaker than the popular version.

export type Topic = 'psychology' | 'software' | 'philosophy';

export const TOPICS: { id: Topic; name: string }[] = [
  { id: 'psychology', name: 'Psychology' },
  { id: 'software', name: 'Software engineering' },
  { id: 'philosophy', name: 'Philosophy' },
];

export interface Knowledge {
  id: string;
  topic: Topic;
  title: string;
  body: string;
  /** Something to do with it today. */
  tryThis: string;
}

export const KNOWLEDGE: Knowledge[] = [
  // ---------- Psychology ----------
  {
    id: 'spacing-effect',
    topic: 'psychology',
    title: 'The spacing effect',
    body: 'Practice spread over several days is remembered far longer than the same amount crammed into one sitting. Reviewing just as something starts to fade is what makes it stick.',
    tryThis: "Look back at today's chapter tomorrow, then again in a week.",
  },
  {
    id: 'testing-effect',
    topic: 'psychology',
    title: 'Retrieval beats rereading',
    body: 'Pulling an idea out of memory strengthens it more than reading it again, even when the recall is slow and patchy. Rereading feels productive because it is familiar, not because it works.',
    tryThis: 'Close the book and say the three main points of what you just read.',
  },
  {
    id: 'generation-effect',
    topic: 'psychology',
    title: 'The generation effect',
    body: 'Information you produce yourself, even a wrong guess that gets corrected, is remembered better than information you only read. Effort at the moment of learning pays off later.',
    tryThis: 'Before reading a section, guess what it will say.',
  },
  {
    id: 'feynman',
    topic: 'psychology',
    title: 'Explain it simply',
    body: 'Explaining an idea in plain words, as if to a beginner, exposes the gaps you skipped over. Where you reach for jargon is usually where your understanding stops.',
    tryThis: "Explain one idea from your book to a friend who hasn't read it.",
  },
  {
    id: 'sleep-memory',
    topic: 'psychology',
    title: 'Sleep files your memories',
    body: 'During sleep the brain replays and strengthens what was learned that day. Studying late and then sleeping well beats staying up late to study more.',
    tryThis: 'Review what matters most shortly before bed.',
  },
  {
    id: 'cognitive-load',
    topic: 'psychology',
    title: 'Working memory is small',
    body: 'We can hold only about four chunks of new information in mind at once. Experts cope by grouping many details into one familiar chunk.',
    tryThis: 'Break anything you need to remember into groups of three or four.',
  },
  {
    id: 'attention-residue',
    topic: 'psychology',
    title: 'Attention residue',
    body: 'When you switch tasks, part of your attention stays behind on the last one, especially if it was left unfinished. Frequent switching leaves you working with a fraction of your mind.',
    tryThis: 'Batch messages into two or three set times instead of checking constantly.',
  },
  {
    id: 'implementation-intentions',
    topic: 'psychology',
    title: 'When–then plans',
    body: 'Plans phrased as "when X happens, I will do Y" make people much more likely to follow through than a general intention. The cue does the remembering for you.',
    tryThis: 'Write one: "When I sit down on the train, I will read ten pages."',
  },
  {
    id: 'zeigarnik',
    topic: 'psychology',
    title: 'Unfinished business',
    body: 'Unfinished tasks tend to keep nagging at the mind (the Zeigarnik effect, though later studies are mixed). Writing down the next step seems to quiet the nagging and makes restarting easier.',
    tryThis: 'End each work session by noting exactly what to do first next time.',
  },
  {
    id: 'planning-fallacy',
    topic: 'psychology',
    title: 'The planning fallacy',
    body: 'We underestimate how long our own tasks will take, even when we know similar tasks ran late before. Imagining the steps makes us optimistic; looking at past cases makes us accurate.',
    tryThis: 'Estimate from how long the last similar task actually took.',
  },
  {
    id: 'peak-end',
    topic: 'psychology',
    title: 'The peak–end rule',
    body: 'We remember an experience mostly by its most intense moment and by how it ended, not by its average or its length (Kahneman). A good ending can redeem a long, dull middle.',
    tryThis: 'Finish meetings and study sessions on something that went well.',
  },
  {
    id: 'loss-aversion',
    topic: 'psychology',
    title: 'Loss aversion',
    body: 'A loss feels roughly twice as strong as a gain of the same size (Kahneman and Tversky). It makes us cling to the status quo and turn down bets that are actually good.',
    tryThis: 'Ask whether you are avoiding a loss or chasing a better outcome.',
  },
  {
    id: 'anchoring',
    topic: 'psychology',
    title: 'Anchoring',
    body: 'The first number we hear pulls our estimates towards it, even when it is obviously arbitrary. Negotiators and price tags use this on purpose.',
    tryThis: 'Write down your own estimate before hearing anyone else’s.',
  },
  {
    id: 'confirmation-bias',
    topic: 'psychology',
    title: 'Confirmation bias',
    body: 'We notice, seek out and remember evidence that supports what we already believe, and discount the rest. Smart people are not immune; they are better at finding reasons.',
    tryThis: 'For a belief you hold, ask what evidence would change your mind.',
  },
  {
    id: 'attribution-error',
    topic: 'psychology',
    title: 'The fundamental attribution error',
    body: "We explain other people's behaviour by their character, but our own by our circumstances. The driver who cut you off is a jerk; when you do it, you were late.",
    tryThis: 'Next time someone annoys you, think of one situation that could explain it.',
  },
  {
    id: 'dunning-kruger',
    topic: 'psychology',
    title: 'Knowing what you don’t know',
    body: 'In the Dunning–Kruger studies the weakest performers overestimated themselves the most, partly because judging skill takes the same skill. The popular version exaggerates it, but the humility lesson holds.',
    tryThis: 'Ask someone more skilled to rate your work before you rate it yourself.',
  },
  {
    id: 'hedonic-adaptation',
    topic: 'psychology',
    title: 'Hedonic adaptation',
    body: 'After most gains and losses, happiness drifts back towards where it was. New things stop feeling new; variety and gratitude slow the fade.',
    tryThis: 'Notice one thing you have grown used to and would miss if it were gone.',
  },
  {
    id: 'spotlight-effect',
    topic: 'psychology',
    title: 'The spotlight effect',
    body: 'People notice our mistakes and appearance far less than we think (Gilovich). Everyone is mostly busy with their own spotlight.',
    tryThis: 'Try the thing you are putting off because it might look awkward.',
  },
  {
    id: 'flow',
    topic: 'psychology',
    title: 'Flow',
    body: 'Deep absorption tends to come when a task is just beyond your current skill, the goal is clear and feedback is immediate (Csikszentmihalyi). Too easy is boring; too hard is anxious.',
    tryThis: 'Make a dull task harder, or a daunting one smaller, until it grips you.',
  },
  {
    id: 'fresh-start',
    topic: 'psychology',
    title: 'The fresh start effect',
    body: 'People are more likely to begin new goals on dates that feel like new beginnings: a Monday, a birthday, the first of the month. The date changes nothing, but the story does.',
    tryThis: 'Pick a near "fresh start" day for a habit you keep postponing.',
  },

  // ---------- Software engineering ----------
  {
    id: 'work-right-fast',
    topic: 'software',
    title: 'Make it work, make it right, make it fast',
    body: 'In that order (Kent Beck). A working version shows you what the problem really is; cleaning it up comes next; speed matters only once you have measured where it is slow.',
    tryThis: 'Get the ugliest working version of your task done first.',
  },
  {
    id: 'premature-optimization',
    topic: 'software',
    title: 'Premature optimization',
    body: 'Knuth warned that optimizing too early causes much of the trouble in programming. Most time is spent in a small part of the code, and intuition about which part is usually wrong.',
    tryThis: 'Profile before you optimize anything.',
  },
  {
    id: 'yagni',
    topic: 'software',
    title: 'YAGNI',
    body: '"You aren\'t gonna need it": build for the requirements you have, not the ones you imagine. Speculative flexibility costs complexity now and is usually the wrong flexibility later.',
    tryThis: 'Delete one option, flag or parameter nothing uses.',
  },
  {
    id: 'wrong-abstraction',
    topic: 'software',
    title: 'Duplication beats the wrong abstraction',
    body: 'Merging code that only looks alike creates an abstraction that fights every later change (Sandi Metz). A common rule of thumb is to wait for the third copy before abstracting.',
    tryThis: 'Next time you see two similar functions, leave them until a third appears.',
  },
  {
    id: 'chestertons-fence',
    topic: 'software',
    title: "Chesterton's fence",
    body: "Don't remove a fence until you know why it was put up (G. K. Chesterton). Odd code often guards against a bug someone already hit.",
    tryThis: 'Check the history (git blame) before deleting code that looks pointless.',
  },
  {
    id: 'conways-law',
    topic: 'software',
    title: "Conway's law",
    body: "Systems end up mirroring the communication structure of the teams that build them. Three teams will tend to produce a three-part system, whether or not that's the right design.",
    tryThis: 'Look at your architecture diagram and your org chart side by side.',
  },
  {
    id: 'brooks-law',
    topic: 'software',
    title: "Brooks's law",
    body: 'Adding people to a late software project makes it later (Fred Brooks). Newcomers need onboarding, and every extra person adds communication paths.',
    tryThis: 'When behind, cut scope before adding people.',
  },
  {
    id: 'hofstadters-law',
    topic: 'software',
    title: "Hofstadter's law",
    body: "It always takes longer than you expect, even when you take Hofstadter's law into account. Unknowns are, by definition, missing from the estimate.",
    tryThis: 'Give ranges, not single numbers, when you estimate.',
  },
  {
    id: 'hyrums-law',
    topic: 'software',
    title: "Hyrum's law",
    body: 'With enough users, every observable behaviour of a system will be depended on by somebody, documented or not. Changing "internal" details can still break people.',
    tryThis: 'Treat error messages and ordering as part of your interface.',
  },
  {
    id: 'galls-law',
    topic: 'software',
    title: "Gall's law",
    body: 'A complex system that works has almost always evolved from a simple system that worked. Complex systems designed from scratch rarely work at all.',
    tryThis: 'Ship the smallest end-to-end version before adding features.',
  },
  {
    id: 'rubber-duck',
    topic: 'software',
    title: 'Rubber duck debugging',
    body: 'Explaining your code line by line, even to a rubber duck, often reveals the bug before you finish. Saying it out loud forces you to check what you assumed.',
    tryThis: 'Before asking for help, write the question out in full.',
  },
  {
    id: 'git-bisect',
    topic: 'software',
    title: 'Binary search for bugs',
    body: 'git bisect finds the commit that broke something by halving the range each step. A thousand commits take about ten tests.',
    tryThis: 'Next regression, run git bisect instead of reading diffs.',
  },
  {
    id: 'see-test-fail',
    topic: 'software',
    title: 'Watch the test fail',
    body: "A test you've never seen fail might not test anything. Writing it first, or breaking the code briefly, proves it can catch the bug.",
    tryThis: 'Break the code on purpose and check your new test goes red.',
  },
  {
    id: 'small-changes',
    topic: 'software',
    title: 'Small changes get real reviews',
    body: 'Reviewers find more problems in small changes; very large ones tend to get skimmed and approved. Small changes are also easier to revert.',
    tryThis: 'Split your next change so each part does one thing.',
  },
  {
    id: 'boy-scout',
    topic: 'software',
    title: 'The Boy Scout rule',
    body: 'Leave the code a little cleaner than you found it. Small, constant tidying keeps a codebase healthy without big rewrites.',
    tryThis: 'Rename one confusing variable in the file you touch today.',
  },
  {
    id: 'idempotency',
    topic: 'software',
    title: 'Make retries safe',
    body: 'An idempotent operation has the same effect whether it runs once or five times. Networks fail halfway, so anything that may be retried should be idempotent.',
    tryThis: 'Give each request an id so a repeat can be recognised and ignored.',
  },
  {
    id: 'parse-dont-validate',
    topic: 'software',
    title: "Parse, don't validate",
    body: 'Turn raw input into a type that can only hold valid data, once, at the edge (Alexis King). Then the rest of the code never has to check again.',
    tryThis: 'Replace a boolean check with a function that returns a stronger type.',
  },
  {
    id: 'least-astonishment',
    topic: 'software',
    title: 'Least astonishment',
    body: 'A component should behave the way most users would expect. If it surprises people, the design, not the users, is usually wrong.',
    tryThis: 'Watch someone use your feature without explaining it.',
  },
  {
    id: 'naming',
    topic: 'software',
    title: 'Two hard things',
    body: 'A well-known joke says the hard problems in computing are cache invalidation and naming things. A precise name is a small design decision; a vague one hides a muddled idea.',
    tryThis: 'If you cannot name a function well, ask whether it does two things.',
  },
  {
    id: 'big-o',
    topic: 'software',
    title: 'Feel the Big-O',
    body: 'A loop inside a loop over 10,000 items is 100 million steps. Fine for a list of 100, painful at a million: growth rate matters more than constant speed.',
    tryThis: 'Find one nested loop and ask how big its input can get.',
  },

  // ---------- Philosophy ----------
  {
    id: 'dichotomy-of-control',
    topic: 'philosophy',
    title: 'The dichotomy of control',
    body: 'Epictetus split the world into what is up to us (our judgments and actions) and what is not (everything else). Peace comes from putting effort only into the first.',
    tryThis: 'Sort one worry into what you control and what you don’t.',
  },
  {
    id: 'obstacle-way',
    topic: 'philosophy',
    title: 'The obstacle becomes the way',
    body: 'Marcus Aurelius wrote that what blocks an action can itself become a path for acting well. A setback is a chance to practise patience, courage or skill.',
    tryThis: 'Ask what today’s annoyance lets you practise.',
  },
  {
    id: 'premeditatio',
    topic: 'philosophy',
    title: 'Rehearse what could go wrong',
    body: 'The Stoics imagined losses and setbacks in advance, so they would hurt less and find them ready. Modern teams do the same in a "pre-mortem".',
    tryThis: 'Before a plan starts, list three ways it could fail.',
  },
  {
    id: 'memento-mori',
    topic: 'philosophy',
    title: 'Memento mori',
    body: 'Remember that you will die. For the Stoics this was not gloom but focus: it makes trivial things shrink and important ones clear.',
    tryThis: 'Ask whether today’s biggest worry will matter in five years.',
  },
  {
    id: 'shortness-of-life',
    topic: 'philosophy',
    title: 'On the shortness of life',
    body: "Seneca argued that life is long enough if we use it well; we make it short by giving our time away carelessly. People guard their money but hand out their hours.",
    tryThis: 'Notice one hour this week you gave away without choosing to.',
  },
  {
    id: 'occams-razor',
    topic: 'philosophy',
    title: "Occam's razor",
    body: 'When two explanations fit the facts, prefer the one that assumes less. It is a rule for where to look first, not proof that the simple answer is right.',
    tryThis: 'Next time something breaks, check the most boring cause first.',
  },
  {
    id: 'hanlons-razor',
    topic: 'philosophy',
    title: "Hanlon's razor",
    body: "Never attribute to malice what can be adequately explained by carelessness. Most slights are accidents; assuming so keeps you calm and usually right.",
    tryThis: 'Reread an annoying message assuming the sender was simply rushed.',
  },
  {
    id: 'socratic-ignorance',
    topic: 'philosophy',
    title: 'Socratic ignorance',
    body: 'Socrates was said to be wise only because he knew that he did not know. His method was to keep asking questions until hidden assumptions came into view.',
    tryThis: 'Ask "how do I know that?" about one thing you are sure of.',
  },
  {
    id: 'charity',
    topic: 'philosophy',
    title: 'The principle of charity',
    body: 'Interpret an argument in its strongest, most reasonable form before you answer it ("steelmanning"). Beating a weak version teaches you nothing.',
    tryThis: 'Restate someone’s view until they agree you got it right.',
  },
  {
    id: 'golden-mean',
    topic: 'philosophy',
    title: 'The golden mean',
    body: 'Aristotle saw each virtue as a middle between two vices: courage between cowardice and recklessness, generosity between stinginess and waste.',
    tryThis: 'Pick a trait you value and name its two extremes.',
  },
  {
    id: 'virtue-habit',
    topic: 'philosophy',
    title: 'Character is practised',
    body: 'Aristotle argued that we become brave by doing brave things and fair by doing fair things. Virtue is less a feeling than a habit built by repetition.',
    tryThis: 'Do one small act today of the person you want to become.',
  },
  {
    id: 'categorical-imperative',
    topic: 'philosophy',
    title: 'Could everyone do it?',
    body: 'Kant proposed acting only on rules you could want everyone to follow, and never treating people merely as tools. If an act only works because others don’t do it, suspect it.',
    tryThis: 'Test a shortcut: what if everyone took it?',
  },
  {
    id: 'utilitarianism',
    topic: 'philosophy',
    title: 'The greatest good',
    body: 'Bentham and Mill judged actions by their consequences for everyone’s wellbeing. Its power is its fairness; its critics ask what it permits against a few.',
    tryThis: 'For a decision, list everyone it affects, not just you.',
  },
  {
    id: 'veil-of-ignorance',
    topic: 'philosophy',
    title: 'The veil of ignorance',
    body: 'Rawls asked what rules you would choose for society if you did not know who you would be in it: rich or poor, healthy or sick. It is a test for fairness.',
    tryThis: 'Judge a rule at work as if you might be on its losing side.',
  },
  {
    id: 'is-ought',
    topic: 'philosophy',
    title: 'Is and ought',
    body: 'Hume noticed that arguments slide from how things are to how they ought to be without justifying the step. Facts alone never settle what we should do.',
    tryThis: 'Spot the hidden "should" in an argument that only lists facts.',
  },
  {
    id: 'ship-of-theseus',
    topic: 'philosophy',
    title: 'The ship of Theseus',
    body: 'If every plank of a ship is replaced one at a time, is it still the same ship? The puzzle asks what makes anything, including a person, stay itself through change.',
    tryThis: 'Think of how much of you has changed in ten years, and what hasn’t.',
  },
  {
    id: 'heraclitus-river',
    topic: 'philosophy',
    title: 'The same river',
    body: 'Heraclitus held that everything flows: you cannot step into the same river twice, for both it and you have changed. Stability is a slow kind of change.',
    tryThis: 'Revisit something you once judged, and see it with today’s eyes.',
  },
  {
    id: 'sisyphus',
    topic: 'philosophy',
    title: 'Sisyphus, happy',
    body: 'Camus pictured Sisyphus pushing his rock forever and concluded we must imagine him happy. Meaning is not found at the top but made in the pushing.',
    tryThis: 'Find one thing to enjoy in a task you repeat every day.',
  },
  {
    id: 'amor-fati',
    topic: 'philosophy',
    title: 'Amor fati',
    body: 'Nietzsche urged loving your fate: not just putting up with what happens, but wanting it to be as it is. The Stoics held a gentler version, accepting what comes.',
    tryThis: 'Name one past setback that led somewhere you are glad to be.',
  },
  {
    id: 'pascal-room',
    topic: 'philosophy',
    title: 'Sitting quietly in a room',
    body: 'Pascal thought much human misery comes from being unable to sit quietly in a room alone. We chase distraction to avoid our own thoughts.',
    tryThis: 'Spend two minutes of this ride just looking out of the window.',
  },
];

/**
 * The next card to show: one not yet seen from the chosen topics, picked with `random`
 * (0 to 1). Once all of them are seen, those topics start over. Returns the card and the
 * new list of seen ids; null when no topic is chosen.
 */
export function pickKnowledge(topics: readonly Topic[], seen: readonly string[], random: number): { id: string; seen: string[] } | null {
  const deck = KNOWLEDGE.filter((k) => topics.includes(k.topic));
  if (deck.length === 0) return null;
  const seenSet = new Set(seen);
  let fresh = deck.filter((k) => !seenSet.has(k.id));
  let kept = [...seen];
  if (fresh.length === 0) {
    // Round done: forget these topics' cards, keep the others' history.
    const inDeck = new Set(deck.map((k) => k.id));
    kept = kept.filter((id) => !inDeck.has(id));
    fresh = deck;
  }
  const card = fresh[Math.min(fresh.length - 1, Math.floor(random * fresh.length))];
  return { id: card.id, seen: [...kept, card.id] };
}

export const knowledgeById = (id: string) => KNOWLEDGE.find((k) => k.id === id);
