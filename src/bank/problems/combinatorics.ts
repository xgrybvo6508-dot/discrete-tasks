import type { Problem } from '../types';

export const COMBINATORICS_PROBLEMS = [
  {
    id: 'comb-001',
    source: 'bank',
    topic: 'combinatorics',
    subtopics: ['Dyck paths', 'bijections', 'Catalan numbers'],
    difficulty: 4,
    title: 'Primitive Dyck paths',
    statement:
      'For an integer $n \\ge 1$, a Dyck path of semilength $n$ is a lattice path from $(0,0)$ to $(2n,0)$ with steps $U=(1,1)$ and $D=(1,-1)$ that never goes below the $x$-axis. Call it **primitive** if it touches the $x$-axis only at its two endpoints.\n\nFind a closed formula in $n$ for the number of primitive Dyck paths of semilength $n$.',
    hints: [
      'Every nonempty Dyck path starts with $U$ and ends with $D$. What is special about the part between these steps for a primitive path?',
      'Remove the first and last steps. The remaining path stays at height at least $1$.',
      'Shift the remaining path down by one unit. This gives a bijection with an unrestricted Dyck path of semilength $n-1$.',
    ],
    solution:
      'Let $P$ be a primitive Dyck path of semilength $n$. It has the form $UQD$. Because $P$ has no intermediate point on the $x$-axis, every vertex of $Q$ has height at least $1$ in $P$.\n\nDelete the initial $U$ and final $D$, then shift $Q$ down by one unit. The result starts and ends at height $0$, has $n-1$ up-steps and $n-1$ down-steps, and never goes below height $0$. It is therefore an arbitrary Dyck path of semilength $n-1$.\n\nConversely, shift any Dyck path of semilength $n-1$ up by one unit, then add an initial $U$ and a final $D$. All its intermediate vertices have positive height, so the resulting path is primitive. These operations are inverse bijections.\n\nDyck paths of semilength $m$ are counted by the Catalan number\n\n$$C_m=\\frac{1}{m+1}\\binom{2m}{m}.$$\n\nTaking $m=n-1$, the required number is\n\n$$C_{n-1}=\\frac{1}{n}\\binom{2n-2}{n-1}.$$',
    answer: {
      type: 'expression',
      canonical: 'binom(2*n - 2, n - 1) / n',
      display: '$\\displaystyle \\frac{1}{n}\\binom{2n-2}{n-1}=C_{n-1}$',
      nRange: [1, 15],
    },
    related: ['ind-002'],
    estMinutes: 15,
  },
  {
    id: 'comb-002',
    source: 'bank',
    topic: 'combinatorics',
    subtopics: ['compositions', 'recurrences', 'Fibonacci numbers'],
    difficulty: 3,
    title: 'Compositions into odd parts',
    statement:
      'A composition of $12$ is an ordered sequence of positive integers whose sum is $12$. How many compositions of $12$ have every part odd?',
    hints: [
      'Let $a_m$ count the odd-part compositions of $m$, and include the empty composition by setting $a_0=1$. Condition on the first part.',
      'The first part can be $1,3,5,\\ldots$, so $a_m=a_{m-1}+a_{m-3}+a_{m-5}+\\cdots$.',
      'Compare the sums for $a_m$ and $a_{m-2}$ to obtain a two-term recurrence. Then compute up to $m=12$.',
    ],
    solution:
      'Let $a_m$ be the number of compositions of $m$ into odd parts, with $a_0=1$. Choosing the first part gives\n\n$$a_m=a_{m-1}+a_{m-3}+a_{m-5}+\\cdots,$$\n\nwhere terms with negative subscripts are omitted. For $m\\ge 2$,\n\n$$a_{m-2}=a_{m-3}+a_{m-5}+\\cdots.$$\n\nSubtracting the second equality from the first yields\n\n$$a_m=a_{m-1}+a_{m-2}.$$\n\nThe initial values are $a_0=1$ and $a_1=1$. Thus $a_m=F_m$ for $m\\ge 1$, where $F_1=F_2=1$. Iterating gives\n\n$$(a_1,a_2,\\ldots,a_{12})=(1,1,2,3,5,8,13,21,34,55,89,144).$$\n\nTherefore there are $144$ such compositions.',
    answer: {
      type: 'numeric',
      canonical: 144,
      display: '$144$',
    },
    related: ['rec-002'],
    estMinutes: 12,
  },
  {
    id: 'comb-003',
    source: 'bank',
    topic: 'combinatorics',
    subtopics: ['double counting', "Vandermonde's identity", 'binomial coefficients'],
    difficulty: 4,
    title: 'Two committees and a chair',
    statement:
      'For an integer $n \\ge 1$, find a closed formula for\n\n$$\\sum_{k=0}^{n} k\\binom{n}{k}^{2}.$$\n\nGive your answer as an expression in $n$.',
    hints: [
      'Take two disjoint labelled sets $A$ and $B$, each with $n$ elements. Interpret the term for $k$ using a $k$-element subset of each set and a distinguished element from the subset of $A$.',
      'Count the same objects by choosing the distinguished element of $A$ first.',
      'After fixing that element, write the two remaining subset sizes as $j$ and $j+1$. A form of Vandermonde’s identity evaluates the resulting sum.',
    ],
    solution:
      'Let $A$ and $B$ be disjoint labelled sets with $|A|=|B|=n$. Count triples $(S,T,c)$ such that $S\\subseteq A$, $T\\subseteq B$, $|S|=|T|$, and $c\\in S$ is distinguished.\n\nIf $|S|=|T|=k$, there are $\\binom{n}{k}$ choices for each subset and $k$ choices for $c$. Hence the number of triples is the given sum.\n\nCount instead by first choosing $c\\in A$, in $n$ ways. Put $j=|S\\setminus\\{c\\}|$. Then choose the other $j$ elements of $S$ from $A\\setminus\\{c\\}$ and choose the $j+1$ elements of $T$ from $B$. This gives\n\n$$n\\sum_{j=0}^{n-1}\\binom{n-1}{j}\\binom{n}{j+1}.$$\n\nUsing $\\binom{n}{j+1}=\\binom{n}{n-1-j}$, Vandermonde’s identity gives\n\n$$\\sum_{j=0}^{n-1}\\binom{n-1}{j}\\binom{n}{n-1-j}=\\binom{2n-1}{n-1}.$$\n\nTherefore\n\n$$\\sum_{k=0}^{n} k\\binom{n}{k}^{2}=n\\binom{2n-1}{n-1}.$$',
    answer: {
      type: 'expression',
      canonical: 'n * binom(2*n - 1, n - 1)',
      display: '$\\displaystyle n\\binom{2n-1}{n-1}$',
      nRange: [1, 15],
    },
    estMinutes: 18,
  },
] satisfies readonly Problem[];
