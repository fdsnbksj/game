import type { Highlight } from './highlights';

// Ready-made sets for players who want to start learning before they've highlighted
// anything. They are key ideas written in our own words, never the book's text: the
// books are copyrighted, and a player's own highlights are the way to get exact lines.

export interface StarterSet {
  book: string;
  /** What the set is, shown before adding it. */
  about: string;
  lines: string[];
}

export const STARTER_SETS: StarterSet[] = [
  {
    book: 'Make Something Wonderful',
    about: "Steve Jobs in his own words, from the Steve Jobs Archive. Key ideas, retold in our words, not quotes.",
    lines: [
      'Jobs saw the computer as a bicycle for the mind: a tool that multiplies what a person can do alone.',
      'The bicycle idea came from a study of how efficiently animals move, where a person on a bicycle beat even the condor.',
      'He felt the best way to thank humanity was to make something wonderful and put it out into the world.',
      'His 2005 Stanford commencement speech told three stories: connecting the dots, love and loss, and death.',
      'You can only connect the dots of your life looking backwards, so you have to trust that they will connect later.',
      'After dropping out of college he sat in on a calligraphy class, and its lessons in typography later shaped the Macintosh.',
      'Being pushed out of Apple in 1985 let him feel like a beginner again, and led him to found NeXT and to buy Pixar.',
      'Remembering that he would die was his most useful tool for making the big choices in life.',
      'He urged graduates not to settle, and to keep searching until they found work they loved.',
      'He saw death as the best invention of life, because it clears away the old to make room for the new.',
      "Because time is limited, he warned against living a life shaped by other people's expectations.",
      'Focus, to him, meant saying no to hundreds of good ideas so the few best ones could be done well.',
      'On his return in 1997 he said to start with the customer experience and work backwards to the technology.',
      "He cut Apple's sprawling product line down to four: consumer and professional, desktop and portable.",
      "The Think Different campaign celebrated misfits and rebels, to remind Apple of what it stood for.",
      'He described Apple as standing at the intersection of technology and the liberal arts.',
      'For Jobs, design meant how a product works, not merely its decoration.',
      'He held that simplicity is harder than complexity, because it takes hard work to make your thinking clear.',
      'In a 1983 talk at the Aspen design conference he predicted computers that would be networked and small enough to carry.',
      'At Aspen he urged designers to care about computers, since people would soon spend more time with them than with cars.',
      'He admired craftsmen who finish the back of a cabinet with care, even though no one will ever see it.',
      'He told the Macintosh team it was better to be pirates than to join the navy.',
      'He insisted that finishing and shipping the work is part of being an artist.',
      'He thought it made no sense to hire brilliant people and then tell them what to do.',
      'He believed a small team of the very best people could outdo a much larger group of average ones.',
      'He wanted Apple to be a yardstick of quality in places where people were not used to excellence.',
      'He preferred that Apple replace its own successful products before a competitor could do it.',
      'NeXT set out to build a powerful workstation for universities and higher education.',
      "Pixar's Toy Story, released in 1995, was the first feature film made entirely with computer animation.",
      'In 2007 he introduced the iPhone as three devices in one: an iPod, a phone and an internet communicator.',
      'In a note to himself he reflected that nearly everything he used, from food to language, was made by others, and he felt grateful.',
    ],
  },
];

export const starterHighlights = (set: StarterSet): Highlight[] => set.lines.map((text) => ({ book: set.book, text }));
