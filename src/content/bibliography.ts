/**
 * Sources.
 *
 * Every citation here was checked against the publisher's record or the paper
 * itself while the site was being built, not recalled. Where a claim on the page
 * rests on one of these, the entry says which claim.
 *
 * None of these studies tested the arbitrary rearrangements this site generates,
 * and none of them fitted our scoring weights. They motivate which properties are
 * worth measuring. They do not validate the number we show.
 */

export interface Reference {
  id: string
  authors: string
  year: string
  title: string
  venue: string
  url: string
  /** What this site takes from it. */
  relevance: string
}

export const REFERENCES: Reference[] = [
  {
    id: 'davis',
    authors: 'Davis, M.',
    year: 'n.d.',
    title: 'Reading jumbled texts: the "Cambridge University" email',
    venue: 'MRC Cognition and Brain Sciences Unit, University of Cambridge',
    url: 'https://www.mrc-cbu.cam.ac.uk/people/matt.davis/cmabrigde/',
    relevance:
      'The definitive response to the meme. Traces it to Graham Rawlinson’s 1976 Nottingham PhD thesis, and lists the properties that make the famous paragraph unusually easy: short and function words left untouched, adjacent rather than distant transpositions, no rearrangement that creates a different word, and jumbles that preserve how the word sounds. Those observations are the origin of several of our features.',
  },
  {
    id: 'rawlinson',
    authors: 'Rawlinson, G.',
    year: '1976',
    title: 'The significance of letter position in word recognition (summary)',
    venue: 'PhD thesis, University of Nottingham. Summary hosted by the MRC Cognition and Brain Sciences Unit',
    url: 'https://www.mrc-cbu.cam.ac.uk/people/matt.davis/Cmabrigde/rawlinson.html',
    relevance:
      'The actual origin of the demonstration the meme stole, twenty-seven years before it started circulating. Rawlinson\u2019s own summary, written for Davis\u2019s page, including what he was testing and against which theories of word recognition.',
  },
  {
    id: 'rayner2006',
    authors: 'Rayner, K., White, S. J., Johnson, R. L., & Liversedge, S. P.',
    year: '2006',
    title: 'Raeding wrods with jubmled lettres: There is a cost',
    venue: 'Psychological Science, 17(3), 192–193',
    url: 'https://doi.org/10.1111/j.1467-9280.2006.01684.x',
    relevance:
      'Measured eye movements rather than asking whether people could cope. Jumbled text is read measurably more slowly, so the meme’s "it doesn’t matter" is false as stated. This is why the site never claims scrambling is free.',
  },
  {
    id: 'white2008',
    authors: 'White, S. J., Johnson, R. L., Liversedge, S. P., & Rayner, K.',
    year: '2008',
    title: 'Eye movements when reading transposed text: The importance of word-beginning letters',
    venue: 'Journal of Experimental Psychology: Human Perception and Performance, 34(5), 1261–1276',
    url: 'https://doi.org/10.1037/0096-1523.34.5.1261',
    relevance:
      'Transpositions near the start of a word disrupt reading far more than ones near the end, and the effect is larger for low-frequency words. This is the direct basis for weighting disruption towards the beginning of the word.',
  },
  {
    id: 'perea2003',
    authors: 'Perea, M., & Lupker, S. J.',
    year: '2003',
    title: 'Does jugde activate COURT? Transposed-letter similarity effects in masked associative priming',
    venue: 'Memory & Cognition, 31(6), 829–841',
    url: 'https://doi.org/10.3758/BF03196438',
    relevance:
      'A transposed-letter nonword primes the meaning of the word it was made from, nearly as strongly as the word itself. Letter position is encoded loosely enough that "jugde" still reaches JUDGE.',
  },
  {
    id: 'perea2004',
    authors: 'Perea, M., & Lupker, S. J.',
    year: '2004',
    title: 'Can CANISO activate CASINO? Transposed-letter similarity effects with nonadjacent letter positions',
    venue: 'Journal of Memory and Language, 51(2), 231–246',
    url: 'https://doi.org/10.1016/j.jml.2004.05.005',
    relevance:
      'The effect survives when the transposed letters are not adjacent, which is why our candidate space is all rearrangements rather than only neighbouring swaps.',
  },
  {
    id: 'lupker2008',
    authors: 'Lupker, S. J., Perea, M., & Davis, C. J.',
    year: '2008',
    title: 'Transposed-letter effects: Consonants, vowels and letter frequency',
    venue: 'Language and Cognitive Processes, 23(1), 93–116',
    url: 'https://doi.org/10.1080/01690960701579714',
    relevance:
      'Transposing two consonants still primes the original word; transposing two vowels largely does not. This asymmetry is why moved vowels count separately in our scoring.',
  },
  {
    id: 'acha2008',
    authors: 'Acha, J., & Perea, M.',
    year: '2008',
    title: 'The effect of neighborhood frequency in reading: Evidence with transposed-letter neighbors',
    venue: 'Cognition, 108(1), 290–300',
    url: 'https://doi.org/10.1016/j.cognition.2008.02.006',
    relevance:
      'A word with a higher-frequency transposed-letter neighbour is read more slowly during normal sentence reading. This is the evidence behind the adversarial setting: landing a rearrangement on a commoner word should cost more than landing it on nonsense.',
  },
  {
    id: 'johnson2012',
    authors: 'Johnson, R. L., Staub, A., & Fleri, A. M.',
    year: '2012',
    title: 'Distributional analysis of the transposed-letter neighborhood effect on naming latency',
    venue: 'Journal of Experimental Psychology: Learning, Memory, and Cognition, 38(6), 1773–1779',
    url: 'https://doi.org/10.1037/a0028222',
    relevance:
      'The cost of having a transposed-letter neighbour shows up only in the slow tail of responses, not as a uniform slowdown. Most words still simply pop; occasionally one catches.',
  },
  {
    id: 'pagan2016',
    authors: 'Pagán, A., Paterson, K. B., Blythe, H. I., & Liversedge, S. P.',
    year: '2016',
    title: 'An inhibitory influence of transposed-letter neighbors on eye movements during reading',
    venue: 'Psychonomic Bulletin & Review, 23(1), 278–284',
    url: 'https://doi.org/10.3758/s13423-015-0869-5',
    relevance:
      'Replicates the neighbour-inhibition effect in eye movements during ordinary reading rather than in isolated word tasks.',
  },
  {
    id: 'johnson2024',
    authors: 'Johnson, R. L., Koch, C., & Wootten, M.',
    year: '2024',
    title: 'Keep clam and carry on: Misperceptions of transposed-letter neighbours',
    venue: 'Quarterly Journal of Experimental Psychology, 77(7), 1363–1374',
    url: 'https://doi.org/10.1177/17470218231196409',
    relevance:
      'Readers do not merely slow down at these pairs, they sometimes report reading the other word outright. The clearest evidence that a rearrangement can actively mislead rather than just obstruct.',
  },
  {
    id: 'luke2012',
    authors: 'Luke, S. G., & Christianson, K.',
    year: '2012',
    title: 'Semantic predictability eliminates the transposed-letter effect',
    venue: 'Memory & Cognition, 40(4), 628–641',
    url: 'https://doi.org/10.3758/s13421-011-0170-4',
    relevance:
      'When a sentence makes a word highly predictable, the cost of transposing its letters disappears. Context is doing error correction, which is why the same scrambled word is much harder in isolation than in prose.',
  },
  {
    id: 'grainger2006',
    authors: 'Grainger, J., Granier, J.-P., Farioli, F., Van Assche, E., & van Heuven, W. J. B.',
    year: '2006',
    title: 'Letter position information and printed word perception: The relative-position priming constraint',
    venue: 'Journal of Experimental Psychology: Human Perception and Performance, 32(4), 865–884',
    url: 'https://doi.org/10.1037/0096-1523.32.4.865',
    relevance:
      'What a word shares with a prime is the relative order of its letters rather than their absolute slots — the constraint behind open-bigram models of letter position. Our preserved-bigram and preserved-trigram features are a crude stand-in for that idea.',
  },
  {
    id: 'gomez2008',
    authors: 'Gómez, P., Ratcliff, R., & Perea, M.',
    year: '2008',
    title: 'The overlap model: A model of letter position coding',
    venue: 'Psychological Review, 115(3), 577–601',
    url: 'https://doi.org/10.1037/a0012667',
    relevance:
      'Treats letter position as a noisy distribution over positions rather than a fixed slot, which is the cleanest published explanation of why a letter that moves one place costs less than one that moves four.',
  },
  {
    id: 'vanheuven2014',
    authors: 'van Heuven, W. J. B., Mandera, P., Keuleers, E., & Brysbaert, M.',
    year: '2014',
    title: 'SUBTLEX-UK: A new and improved word frequency database for British English',
    venue: 'Quarterly Journal of Experimental Psychology, 67(6), 1176–1190',
    url: 'https://doi.org/10.1080/17470218.2013.850521',
    relevance:
      'Defines the Zipf scale used for every frequency number on this site. Our frequencies come from a subtitle corpus, not from SUBTLEX itself; the scale is the same.',
  },
]

export const DATA_SOURCES = [
  {
    label: 'Word frequencies',
    detail:
      'hermitdave/FrequencyWords, English OpenSubtitles 2018 list. That repository is MIT for its code and CC BY-SA 4.0 for the lists themselves, so our trimmed 41,601-word Zipf version is shared under CC BY-SA 4.0 too. Built from the OpenSubtitles 2018 corpus via OPUS. A subtitle corpus skews conversational, so rare and technical words are simply absent rather than rated rare.',
    url: 'https://github.com/hermitdave/FrequencyWords',
  },
  {
    label: 'Letter sequence statistics',
    detail:
      'Derived from the same word list, weighted by word frequency, in scripts/build-lexicon.mjs. No external model. Being a derivative of the list, it carries the same CC BY-SA 4.0 terms.',
    url: 'https://github.com/hermitdave/FrequencyWords',
  },
]
