/**
 * Things worth reading badly.
 *
 * All of these are in the public domain in the United States. Each was taken from
 * a scanned source rather than from memory: the poems come from Project Gutenberg
 * transcriptions, noted per sample.
 */

export interface Sample {
  id: string
  title: string
  attribution: string
  /** Why this particular text is interesting to scramble. */
  note: string
  text: string
}

export const SAMPLES: Sample[] = [
  {
    id: 'intro',
    title: 'A short explanation',
    attribution: 'The house sample',
    note: 'Ordinary modern prose, which is what most of the reading research uses.',
    text: `It is surprising how much you can change the letters inside a word and still read it. But some rearrangements are much harder to read than others. Why?`,
  },
  {
    id: 'jabberwocky',
    title: 'Jabberwocky',
    attribution: 'Lewis Carroll, 1871',
    note: 'Half of these words were never English to begin with, so there is no familiar spelling for your eye to fall back on. Watch how much harder the invented words get than the real ones at the same setting.',
    text: `'Twas brillig, and the slithy toves
    Did gyre and gimble in the wabe;
All mimsy were the borogoves,
    And the mome raths outgrabe.

"Beware the Jabberwock, my son!
    The jaws that bite, the claws that catch!
Beware the Jubjub bird, and shun
    The frumious Bandersnatch!"

He took his vorpal sword in hand:
    Long time the manxome foe he sought—
So rested he by the Tumtum tree,
    And stood awhile in thought.

And as in uffish thought he stood,
    The Jabberwock, with eyes of flame,
Came whiffling through the tulgey wood,
    And burbled as it came!

One, two! One, two! And through and through
    The vorpal blade went snicker-snack!
He left it dead, and with its head
    He went galumphing back.

"And hast thou slain the Jabberwock?
    Come to my arms, my beamish boy!
O frabjous day! Callooh! Callay!"
    He chortled in his joy.

'Twas brillig, and the slithy toves
    Did gyre and gimble in the wabe;
All mimsy were the borogoves,
    And the mome raths outgrabe.`,
  },
  {
    id: 'road',
    title: 'The Road Not Taken',
    attribution: 'Robert Frost, 1916',
    note: 'Familiar enough that you may recognise lines before you have actually read them. That is the context effect doing the work, not your eyes.',
    text: `Two roads diverged in a yellow wood,
And sorry I could not travel both
And be one traveler, long I stood
And looked down one as far as I could
To where it bent in the undergrowth;

Then took the other, as just as fair,
And having perhaps the better claim,
Because it was grassy and wanted wear;
Though as for that the passing there
Had worn them really about the same,

And both that morning equally lay
In leaves no step had trodden black.
Oh, I kept the first for another day!
Yet knowing how way leads on to way,
I doubted if I should ever come back.

I shall be telling this with a sigh
Somewhere ages and ages hence:
Two roads diverged in a wood, and I—
I took the one less traveled by,
And that has made all the difference.`,
  },
  {
    id: 'ozymandias',
    title: 'Ozymandias',
    attribution: 'Percy Bysshe Shelley, 1818',
    note: 'Long, low-frequency words like "colossal" and "pedestal" have thousands of legal rearrangements. Short ones like "vast" and "sand" have almost none.',
    text: `I met a traveller from an antique land
Who said: Two vast and trunkless legs of stone
Stand in the desert... Near them, on the sand,
Half sunk, a shattered visage lies, whose frown,
And wrinkled lip, and sneer of cold command,
Tell that its sculptor well those passions read
Which yet survive, stamped on these lifeless things,
The hand that mocked them, and the heart that fed:
And on the pedestal these words appear:
"My name is Ozymandias, king of kings:
Look on my works, ye Mighty, and despair!"
Nothing beside remains. Round the decay
Of that colossal wreck, boundless and bare
The lone and level sands stretch far away.`,
  },
  {
    id: 'meme',
    title: 'The Cambridge meme',
    attribution: 'Anonymous, circulated 2003',
    note: 'The text that started all of this. Cambridge never ran the study. Try reading it at 0 and then look at how gently it was actually scrambled.',
    text: `Aoccdrnig to a rscheearch at Cmabrigde Uinervtisy, it deosn't mttaer in waht oredr the ltteers in a wrod are, the olny iprmoatnt tihng is taht the frist and lsat ltteer be at the rghit pclae. The rset can be a toatl mses and you can sitll raed it wouthit porbelm. Tihs is bcuseae the huamn mnid deos not raed ervey lteter by istlef, but the wrod as a wlohe.`,
  },
]

export const DEFAULT_SAMPLE = SAMPLES[0]
