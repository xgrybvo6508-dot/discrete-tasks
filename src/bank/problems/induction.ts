import type { Problem } from '../types';

export const INDUCTION_PROBLEMS = [
  {
    id: 'ind-001',
    source: 'bank',
    topic: 'induction',
    subtopics: ['strong induction', 'tilings', 'recursive constructions'],
    difficulty: 3,
    title: 'A deficient board tiled by trominoes',
    statement: String.raw`An L-tromino consists of three unit cells in a $2\times 2$ square, with one cell removed. Rotations are allowed.

Prove that for every integer $n\ge 1$, any $2^n\times 2^n$ board with one unit cell removed can be tiled without gaps or overlaps by L-trominoes.`,
    hints: [
      'Use induction on the exponent $n$, not on the side length one unit at a time.',
      'Split a $2^n\\times 2^n$ board into four equal quadrants. Exactly one quadrant contains the originally removed cell.',
      'Look at the four cells nearest the centre. One tromino can cover the central cell in each of the three quadrants that do not contain the original missing cell.',
    ],
    solution: String.raw`We use induction on $n$.

**Base case.** For $n=1$, the board is $2\times 2$. After one cell is removed, the three remaining cells form one L-tromino.

**Inductive step.** Assume that every deficient $2^{n-1}\times 2^{n-1}$ board can be tiled by L-trominoes. Consider a $2^n\times 2^n$ board with one cell removed.

Divide the board into four $2^{n-1}\times 2^{n-1}$ quadrants. One quadrant contains the removed cell. At the centre of the board, take the one corner cell belonging to each of the other three quadrants. Those three cells form an L-tromino, so place one tromino over them.

After this placement, every quadrant is deficient in exactly one cell: the original quadrant has its given missing cell, and each other quadrant has the central cell covered by the new tromino. By the induction hypothesis, the uncovered part of each quadrant can be tiled by L-trominoes. Together with the central tromino, these four tilings cover the whole deficient board without gaps or overlaps.

Therefore the claim holds for every $n\ge 1$.`,
    answer: {
      type: 'proof',
      display: 'Induction by four quadrants and one central L-tromino.',
      keyPoints: [
        'Establishes the base case of a deficient 2 by 2 board.',
        'Splits the larger board into four equal power-of-two quadrants.',
        'Places one central L-tromino so that each unaffected quadrant becomes deficient in one cell.',
        'Applies the induction hypothesis independently to all four deficient quadrants.',
      ],
    },
    estMinutes: 12,
  },
  {
    id: 'ind-002',
    source: 'bank',
    topic: 'induction',
    subtopics: ['geometric counting', 'binomial coefficients', 'induction'],
    difficulty: 4,
    title: 'Regions formed by all chords',
    statement: String.raw`Place $n\ge 1$ distinct labelled points on the boundary of a circle. Draw the straight chord joining every pair of points. Assume general position: no three chords meet at one point in the interior of the circle.

Find the maximum number $R_n$ of regions into which the interior of the circle is divided.`,
    hints: [
      'Add the boundary points one at a time. Count the new regions created by all chords from the newest point.',
      'A new chord creates one region for each segment into which its interior intersections divide it.',
      'Across all chords from the new point, count interior intersections by choosing three old boundary points.',
      'Derive a recurrence for $R_n-R_{n-1}$, then sum it with the hockey-stick identity for binomial coefficients.',
    ],
    solution: String.raw`Start with one boundary point, so $R_1=1$. Add a new point to a configuration of $n-1$ points.

The new point is joined to each old point, giving $n-1$ new chords. If a new chord has $q$ interior intersections, it is split into $q+1$ segments, and drawing it adds $q+1$ regions. General position makes all these intersection points distinct where needed.

There is one intersection involving a new chord for each choice of three old points. Indeed, the new point and those three old points form four boundary points, and the two diagonals of their quadrilateral cross exactly once; exactly one of those diagonals is incident with the new point. Hence the new chords contain $\binom{n-1}{3}$ interior intersections in total.

Therefore
$$
R_n-R_{n-1}=(n-1)+\binom{n-1}{3}.
$$
Summing from $2$ through $n$ and using the hockey-stick identity gives
$$
\begin{aligned}
R_n
&=1+\sum_{i=2}^{n}(i-1)+\sum_{i=2}^{n}\binom{i-1}{3}\\
&=1+\binom{n}{2}+\binom{n}{4}.
\end{aligned}
$$

The general-position assumption makes every possible crossing from four boundary points distinct, so this count is attained and is maximal.`,
    answer: {
      type: 'expression',
      canonical: '1 + binom(n, 2) + binom(n, 4)',
      display: String.raw`$R_n=1+\binom{n}{2}+\binom{n}{4}$`,
      nRange: [1, 10],
    },
    related: ['comb-001'],
    estMinutes: 18,
  },
  {
    id: 'ind-003',
    source: 'bank',
    topic: 'induction',
    subtopics: ['Fibonacci numbers', 'divisibility', 'induction'],
    difficulty: 4,
    title: 'A Fibonacci addition identity',
    statement: String.raw`Define the Fibonacci numbers by $F_0=0$, $F_1=1$, and $F_{r+1}=F_r+F_{r-1}$ for every integer $r\ge 1$.

First prove that for all integers $m\ge 1$ and $n\ge 0$,
$$
F_{m+n}=F_mF_{n+1}+F_{m-1}F_n.
$$
Then use this identity to prove that $F_n\mid F_{kn}$ for all integers $n\ge 1$ and $k\ge 1$.`,
    hints: [
      'For the addition identity, fix $m$ and induct on $n$. Start with $n=0$.',
      'In the induction step, write $F_{m+n+1}=F_{m+n}+F_{m+n-1}$ and apply the two preceding identity cases.',
      'For divisibility, induct on $k$ and split the next index as $(k+1)n=kn+n$.',
      'Apply the addition identity with $m=kn$. One resulting term uses the induction hypothesis, and the other already contains a factor $F_n$.',
    ],
    solution: String.raw`Fix an integer $m\ge 1$. We prove the addition identity by induction on $n$.

For $n=0$,
$$
F_m=F_mF_1+F_{m-1}F_0=F_m.
$$
For $n=1$,
$$
F_{m+1}=F_m+F_{m-1}=F_mF_2+F_{m-1}F_1.
$$

Now let $n\ge 1$ and assume the identity holds for $n$ and $n-1$. Using the Fibonacci recurrence and both induction hypotheses,
$$
\begin{aligned}
F_{m+n+1}
&=F_{m+n}+F_{m+n-1}\\
&=\bigl(F_mF_{n+1}+F_{m-1}F_n\bigr)
  +\bigl(F_mF_n+F_{m-1}F_{n-1}\bigr)\\
&=F_mF_{n+2}+F_{m-1}F_{n+1}.
\end{aligned}
$$
This is the required identity with $n$ replaced by $n+1$. Thus the identity holds for every $n\ge 0$.

Now fix $n\ge 1$ and induct on $k$. The case $k=1$ is immediate because $F_n\mid F_n$. Suppose $F_n\mid F_{kn}$. Applying the addition identity with the two indices $kn$ and $n$ gives
$$
F_{(k+1)n}=F_{kn}F_{n+1}+F_{kn-1}F_n.
$$
The first term is divisible by $F_n$ by the induction hypothesis, and the second term visibly has a factor $F_n$. Their sum is therefore divisible by $F_n$.

Hence $F_n\mid F_{kn}$ for all integers $n\ge 1$ and $k\ge 1$.`,
    answer: {
      type: 'proof',
      display: 'The addition identity and the divisibility statement follow by induction.',
      keyPoints: [
        'Proves the Fibonacci addition identity for the stated ranges, including valid base cases.',
        'Uses the Fibonacci recurrence correctly in the induction step for the identity.',
        'Inducts on k for the divisibility claim.',
        'Applies the addition identity to (k+1)n and shows both resulting terms are divisible by F_n.',
      ],
    },
    related: ['nt-002'],
    estMinutes: 18,
  },
] satisfies readonly Problem[];
