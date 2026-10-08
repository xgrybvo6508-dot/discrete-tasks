import type { Problem } from '../types';

export const COUNTING_PRINCIPLES_PROBLEMS = [
  {
    id: 'count-001',
    source: 'bank',
    topic: 'counting-principles',
    subtopics: ['inclusion-exclusion', 'permutations', 'block method'],
    difficulty: 4,
    title: 'Forbidden directed adjacencies',
    statement: String.raw`A permutation of $[6]=\{1,2,3,4,5,6\}$ is written from left to right. How many permutations have no index $i\in\{1,2,3,4,5\}$ for which $i$ is immediately followed by $i+1$?

The reverse adjacency $i+1,i$ is allowed.`,
    hints: [
      String.raw`For each $i\in\{1,\ldots,5\}$, define an event that the directed adjacency $i,i+1$ occurs.`,
      String.raw`Apply inclusion-exclusion. In an intersection, overlapping requirements such as $2,3$ and $3,4$ merge into the ordered block $2,3,4$.`,
      String.raw`If a chosen set has $k$ adjacency requirements, contract those directed edges. The resulting objects can be ordered in $(6-k)!$ ways. Sum over the $\binom{5}{k}$ choices.`,
    ],
    solution: String.raw`For $i=1,\ldots,5$, let $A_i$ be the set of permutations in which $i$ is immediately followed by $i+1$. We count permutations outside $\bigcup_{i=1}^{5}A_i$.

Choose a subset $S\subseteq\{1,\ldots,5\}$ of required adjacencies, and write $k=|S|$. The selected edges lie in the path
$$
1\longrightarrow2\longrightarrow3\longrightarrow4\longrightarrow5\longrightarrow6.
$$
Each run of selected edges forms one block whose internal order is forced. Contracting all $k$ selected edges reduces the six symbols to $6-k$ ordered objects. Conversely, every ordering of those objects expands uniquely to a permutation satisfying all requirements in $S$. Hence
$$
\left|\bigcap_{i\in S}A_i\right|=(6-k)!.
$$

There are $\binom{5}{k}$ subsets $S$ of size $k$. Inclusion-exclusion therefore gives
$$
\sum_{k=0}^{5}(-1)^k\binom{5}{k}(6-k)!
=720-600+240-60+10-1
=309.
$$
Thus there are $309$ valid permutations.`,
    answer: {
      type: 'numeric',
      canonical: 309,
      display: '$309$',
    },
    related: ['sets-001'],
    estMinutes: 20,
  },
  {
    id: 'count-002',
    source: 'bank',
    topic: 'counting-principles',
    subtopics: ['pigeonhole principle', 'divisibility', 'antichains'],
    difficulty: 4,
    title: 'A forced divisible pair',
    statement: String.raw`Find the smallest integer $m$ such that every $m$-element subset of
$$
\{1,2,\ldots,100\}
$$
contains distinct elements $a$ and $b$ for which $a\mid b$ or $b\mid a$.`,
    hints: [
      String.raw`Write every positive integer uniquely as $q2^r$, where $q$ is odd.`,
      String.raw`Group the integers from $1$ to $100$ by their odd part $q$. Within one group, any two elements are comparable by divisibility.`,
      String.raw`For sharpness, look for a large subset in the upper half of the interval. Compare its size with the number of possible odd parts.`,
    ],
    solution: String.raw`Every positive integer has a unique representation
$$
x=q2^r,
$$
where $q$ is odd and $r\ge0$. Among the integers from $1$ to $100$, the possible odd parts are the $50$ odd numbers
$$
1,3,5,\ldots,99.
$$

Place each integer into the box labelled by its odd part. If two integers are in the same box, they have the forms $q2^r$ and $q2^s$. Assuming $r<s$, we have
$$
q2^s=2^{s-r}(q2^r),
$$
so the first divides the second. Therefore, by the pigeonhole principle, every subset of size $51$ contains a divisible pair.

It remains to show that $50$ elements do not always suffice. Consider
$$
\{51,52,\ldots,100\}.
$$
This set has $50$ elements. If two distinct members satisfy $a<b$ and $a\mid b$, then $b\ge2a>100$, which is impossible. Thus this set contains no divisible pair.

So the least guaranteed size is $51$.`,
    answer: {
      type: 'numeric',
      canonical: 51,
      display: '$51$',
    },
    related: ['rel-003'],
    estMinutes: 18,
  },
  {
    id: 'count-003',
    source: 'bank',
    topic: 'counting-principles',
    subtopics: ['pigeonhole principle', 'subsequences', 'Erdos-Szekeres theorem'],
    difficulty: 4,
    title: 'A long monotone subsequence',
    statement: String.raw`Let $n\ge1$, and let
$$
a_1,a_2,\ldots,a_{n^2+1}
$$
be distinct real numbers. Prove that the sequence has an increasing subsequence of length $n+1$ or a decreasing subsequence of length $n+1$.

A subsequence keeps the original index order but need not use consecutive terms.`,
    hints: [
      String.raw`Attach information to each position rather than trying to choose the subsequence directly.`,
      String.raw`For each $j$, let $I_j$ and $D_j$ be the lengths of the longest increasing and decreasing subsequences that end at $a_j$.`,
      String.raw`For indices $i<j$, compare $a_i$ and $a_j$. One of the two labels at $j$ must then be larger than the corresponding label at $i$.`,
      String.raw`If both kinds of subsequence had bounded length, all pairs $(I_j,D_j)$ would lie in a finite grid. Show that no two positions can receive the same pair, then apply pigeonhole.`,
    ],
    solution: String.raw`For each position $j$, define
$$
I_j=\text{the maximum length of an increasing subsequence ending at }a_j
$$
and
$$
D_j=\text{the maximum length of a decreasing subsequence ending at }a_j.
$$

Suppose, for a contradiction, that there is no increasing or decreasing subsequence of length $n+1$. Then
$$
1\le I_j\le n
\quad\text{and}\quad
1\le D_j\le n
$$
for every $j$. Thus every pair $(I_j,D_j)$ belongs to the set $\{1,\ldots,n\}^2$, which has only $n^2$ elements.

We now show that the pairs attached to different positions are distinct. Take $i<j$. Since all terms are distinct, exactly one of the following holds.

- If $a_i<a_j$, append $a_j$ to a longest increasing subsequence ending at $a_i$. This gives an increasing subsequence ending at $a_j$ of length $I_i+1$, so $I_j>I_i$.
- If $a_i>a_j$, append $a_j$ to a longest decreasing subsequence ending at $a_i$. This gives a decreasing subsequence ending at $a_j$ of length $D_i+1$, so $D_j>D_i$.

In either case, $(I_i,D_i)\ne(I_j,D_j)$. Hence the $n^2+1$ positions have $n^2+1$ distinct label pairs, but only $n^2$ pairs are available. This contradicts the pigeonhole principle.

Therefore an increasing subsequence of length at least $n+1$ or a decreasing subsequence of length at least $n+1$ must exist. Taking its first $n+1$ terms gives the required length exactly.`,
    answer: {
      type: 'proof',
      display: 'A proof using endpoint length pairs and the pigeonhole principle.',
      keyPoints: [
        'Defines the longest increasing and decreasing subsequence lengths ending at each position.',
        'Shows that for i < j, distinct values force either the increasing label or the decreasing label to grow.',
        'Concludes that all endpoint label pairs are distinct.',
        'Uses the n by n bound and n^2 + 1 positions to obtain a pigeonhole contradiction.',
      ],
    },
    estMinutes: 20,
  },
] satisfies readonly Problem[];
