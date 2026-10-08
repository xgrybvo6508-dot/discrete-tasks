import type { Problem } from '../types';

export const SETS_PROBLEMS = [
  {
    id: 'sets-001',
    source: 'bank',
    topic: 'sets',
    subtopics: ['set identities', 'membership vectors', 'product rule'],
    difficulty: 3,
    title: 'Cover without a triple overlap',
    statement:
      'Let $n\\ge 1$ and $[n]=\\{1,\\ldots,n\\}$. Find, as a function of $n$, the number of ordered triples $(A,B,C)$ of subsets of $[n]$ such that\n\n$$\nA\\cup B\\cup C=[n]\n\\qquad\\text{and}\\qquad\nA\\cap B\\cap C=\\varnothing.\n$$\n\nThe sets may overlap in pairs.',
    hints: [
      'For each element of $[n]$, record a three-bit vector saying whether it belongs to $A$, $B$, and $C$.',
      'Translate the union condition and the intersection condition into forbidden membership vectors.',
      'After removing the forbidden vectors, choose a permitted vector independently for each labelled element.',
    ],
    solution:
      'For each $i\\in[n]$, define its membership vector\n\n$$\n(\\mathbf 1_{i\\in A},\\mathbf 1_{i\\in B},\\mathbf 1_{i\\in C})\\in\\{0,1\\}^3.\n$$\n\nThere are eight possible vectors. The vector $(0,0,0)$ is forbidden because the union must contain $i$. The vector $(1,1,1)$ is forbidden because the triple intersection must not contain $i$. Every other vector is allowed, including vectors with exactly two $1$s because pairwise overlap is permitted.\n\nThus each labelled element has $8-2=6$ possible membership vectors. These choices are independent, and every sequence of choices determines one ordered triple $(A,B,C)$. Therefore the number of triples is\n\n$$\n6^n.\n$$',
    answer: {
      type: 'expression',
      canonical: '6^n',
      display: '$6^n$',
      nRange: [1, 10],
    },
    related: ['count-001'],
    estMinutes: 10,
  },
  {
    id: 'sets-002',
    source: 'bank',
    topic: 'sets',
    subtopics: ['partitions', 'parity', 'constructive existence'],
    difficulty: 3,
    title: 'Balanced partitions of an interval',
    statement:
      'For which integers $n$ with $1\\le n\\le 12$ can $[n]=\\{1,\\ldots,n\\}$ be partitioned into two disjoint sets $A$ and $B$ such that\n\n$$\n|A|=|B|\n\\qquad\\text{and}\\qquad\n\\sum_{a\\in A}a=\\sum_{b\\in B}b?\n$$\n\nReturn the set of all such values of $n$.',
    hints: [
      'Equal cardinalities force one parity condition on $n$. Equal sums force another parity condition on the total sum $1+\\cdots+n$.',
      'Combine those two necessary conditions before checking the upper bound.',
      'For the remaining cases, pair the smallest number with the largest, the next smallest with the next largest, and so on.',
      'Every complementary pair has the same sum. Divide the pairs equally between the two sets.',
    ],
    solution:
      'If $|A|=|B|$, then $n$ must be even. Write $n=2k$. Equal sums also require the total sum to be even. Since\n\n$$\n1+\\cdots+n=\\frac{n(n+1)}2=k(2k+1),\n$$\n\nand $2k+1$ is odd, this total is even exactly when $k$ is even. Thus $n$ must be divisible by $4$.\n\nThis condition is also sufficient. Let $n=4m$. Pair the numbers as\n\n$$\n\\{1,n\\},\\{2,n-1\\},\\ldots,\\{2m,2m+1\\}.\n$$\n\nThere are $2m$ pairs. Every pair has two elements and sum $n+1$. Put any $m$ whole pairs into $A$ and the other $m$ pairs into $B$. Then both sets have $2m$ elements and both have sum $m(n+1)$.\n\nTherefore the admissible positive integers are precisely the multiples of $4$. Under the bound $n\\le12$, these are $4$, $8$, and $12$.',
    answer: {
      type: 'set',
      canonical: [4, 8, 12],
      display: '$\\{4,8,12\\}$',
    },
    estMinutes: 14,
  },
  {
    id: 'sets-003',
    source: 'bank',
    topic: 'sets',
    subtopics: ['countability', 'power sets', 'diagonalisation'],
    difficulty: 4,
    title: 'Finite and infinite subsets of the naturals',
    statement:
      'Let $\\mathbb N=\\{0,1,2,\\ldots\\}$. Prove both statements:\n\n1. The family $\\operatorname{Fin}(\\mathbb N)$ of all finite subsets of $\\mathbb N$ is countably infinite.\n2. The family $\\operatorname{Inf}(\\mathbb N)$ of all infinite subsets of $\\mathbb N$ is uncountable.',
    hints: [
      'Encode a finite subset by a natural number whose binary expansion records membership.',
      'To prove the first family is countably infinite, show both an injection into $\\mathbb N$ and an infinite list of distinct members.',
      'First use characteristic functions and a diagonal argument to show that the full power set $\\mathcal P(\\mathbb N)$ is uncountable.',
      'The power set is the disjoint union of its finite and infinite subsets. What would follow if both parts were countable?',
    ],
    solution:
      'For a finite set $F\\subseteq\\mathbb N$, define\n\n$$\ne(F)=\\sum_{k\\in F}2^k.\n$$\n\nThe sum is a natural number. Uniqueness of binary expansion shows that $e$ is injective: if $e(F)=e(G)$, the positions of the $1$ bits agree, so $F=G$. Hence $\\operatorname{Fin}(\\mathbb N)$ is at most countable. It is infinite because the singleton sets $\\{0\\},\\{1\\},\\{2\\},\\ldots$ are distinct. Therefore it is countably infinite.\n\nNow suppose, for contradiction, that $\\mathcal P(\\mathbb N)$ could be listed as $S_0,S_1,S_2,\\ldots$. Define\n\n$$\nD=\\{k\\in\\mathbb N:k\\notin S_k\\}.\n$$\n\nFor every $j$, the sets $D$ and $S_j$ differ on membership of $j$. Thus $D\\ne S_j$ for every $j$, contradicting that the list contained every subset. Therefore $\\mathcal P(\\mathbb N)$ is uncountable.\n\nFinally,\n\n$$\n\\mathcal P(\\mathbb N)=\\operatorname{Fin}(\\mathbb N)\\cup\\operatorname{Inf}(\\mathbb N).\n$$\n\nIf $\\operatorname{Inf}(\\mathbb N)$ were countable, this union would be a union of two countable sets and would therefore be countable. That contradicts the diagonal argument. Hence $\\operatorname{Inf}(\\mathbb N)$ is uncountable.',
    answer: {
      type: 'proof',
      display:
        '$\\operatorname{Fin}(\\mathbb N)$ is countably infinite, while $\\operatorname{Inf}(\\mathbb N)$ is uncountable.',
      keyPoints: [
        'Gives an injective encoding of every finite subset as a natural number.',
        'Shows that the family of finite subsets is infinite, not merely at most countable.',
        'Proves that the full power set of the naturals is uncountable by diagonalisation.',
        'Uses the decomposition into finite and infinite subsets to prove the infinite-subset family is uncountable.',
      ],
    },
    estMinutes: 22,
  },
] satisfies readonly Problem[];
