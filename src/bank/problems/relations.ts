import type { Problem } from '../types';

export const RELATIONS_PROBLEMS = [
  {
    id: 'rel-001',
    source: 'bank',
    topic: 'relations',
    subtopics: ['equivalence relations', 'set partitions'],
    difficulty: 4,
    title: 'Equivalence relations without singletons',
    statement: String.raw`Let $S=\{1,2,3,4,5,6\}$ be labelled. How many equivalence relations on $S$ have no equivalence class of size $1$?

Two relations are different when they are different subsets of $S\times S$.`,
    hints: [
      'Replace each equivalence relation by the partition formed by its equivalence classes.',
      'List the integer partitions of $6$ in which every part is at least $2$.',
      'For block sizes $4+2$, choose the smaller block. For $3+3$ and $2+2+2$, divide by the factorial of the number of equal-sized blocks.',
    ],
    solution: String.raw`An equivalence relation on a labelled set is determined uniquely by its equivalence classes. Thus we count set partitions of $S$ whose block sizes are all at least $2$.

The possible block-size patterns are
$$
6,\qquad 4+2,\qquad 3+3,\qquad 2+2+2.
$$

Their counts are:

- $6$: there is $1$ partition.
- $4+2$: the two-element block determines the partition, so there are $\binom{6}{2}=15$.
- $3+3$: choosing one block counts the two blocks in both orders, so there are $\frac{1}{2}\binom{6}{3}=10$.
- $2+2+2$: order the six elements, group consecutive elements into pairs, and remove the order within each pair and among the three pairs. This gives
  $$
  \frac{6!}{(2!)^3 3!}=15.
  $$

Therefore the required number is
$$
1+15+10+15=41.
$$`,
    answer: {
      type: 'numeric',
      canonical: 41,
      display: '$41$',
    },
    estMinutes: 12,
  },
  {
    id: 'rel-002',
    source: 'bank',
    topic: 'relations',
    subtopics: ['partial orders', 'Hasse diagrams', 'automorphisms'],
    difficulty: 5,
    title: 'Partial orders on four labelled elements',
    statement: String.raw`How many partial orders are there on the labelled set $S=\{1,2,3,4\}$?

A partial order is a reflexive, antisymmetric, and transitive relation on $S$. Two partial orders are different when they are different subsets of $S\times S$.`,
    hints: [
      'Count unlabelled Hasse diagrams first. An unlabelled poset with automorphism group of size $a$ has $4!/a$ distinct labellings.',
      'For a disconnected Hasse diagram, list the possible connected components: isolated vertices, a two-element chain, a three-element chain, a $V$, or its dual.',
      'A connected cover graph on four vertices is triangle-free. Hence its underlying graph is $P_4$, $K_{1,3}$, or $C_4$.',
      'Up to graph symmetry, $P_4$ has four valid orientation types, $K_{1,3}$ has four, and $C_4$ has two. Account for order automorphisms before adding their labellings.',
    ],
    solution: String.raw`We count isomorphism types of four-element posets through their Hasse diagrams. If an unlabelled poset $P$ has automorphism group of size $|\operatorname{Aut}(P)|$, then it has
$$
\frac{4!}{|\operatorname{Aut}(P)|}
$$
distinct labellings.

First consider disconnected Hasse diagrams.

| Shape | Number of types | Automorphisms per type | Labelled total |
|---|---:|---:|---:|
| Four isolated vertices | $1$ | $24$ | $1$ |
| One $2$-chain and two isolated vertices | $1$ | $2$ | $12$ |
| Two disjoint $2$-chains | $1$ | $2$ | $12$ |
| One $3$-chain and one isolated vertex | $1$ | $1$ | $24$ |
| A $V$ or its dual, plus one isolated vertex | $2$ | $2$ | $24$ |

These contribute $1+12+12+24+24=73$.

Now suppose the Hasse diagram is connected. A cover graph has no triangle: in any acyclic orientation of a triangle, one edge would be implied transitively and would not be a cover. A connected triangle-free graph on four vertices is therefore $P_4$, $K_{1,3}$, or $C_4$.

| Cover graph and orientation | Number of types | Automorphisms per type | Labelled total |
|---|---:|---:|---:|
| $P_4$ giving a $4$-chain | $1$ | $1$ | $24$ |
| The other orientations of $P_4$ | $3$ | $1$ | $72$ |
| $K_{1,3}$, all edges toward or all away from the centre | $2$ | $6$ | $8$ |
| $K_{1,3}$, with mixed directions at the centre | $2$ | $2$ | $24$ |
| $C_4$ forming a diamond | $1$ | $2$ | $12$ |
| $C_4$ with two minimal and two maximal elements | $1$ | $4$ | $6$ |

For completeness, the four path types are the four orientations of its three edges up to reversing the path. For the star, the number of edges directed toward the centre is $0,1,2,$ or $3$. On the cycle, the only transitively reduced possibilities are the diamond and the height-two complete bipartite order.

The connected diagrams contribute
$$
24+72+8+24+12+6=146.
$$
Thus the number of partial orders on the labelled set is
$$
73+146=219.
$$`,
    answer: {
      type: 'numeric',
      canonical: 219,
      display: '$219$',
    },
    estMinutes: 25,
  },
  {
    id: 'rel-003',
    source: 'bank',
    topic: 'relations',
    subtopics: ['partial orders', 'linear extensions', 'Boolean lattices'],
    difficulty: 4,
    title: 'Linear extensions of the Boolean lattice',
    statement: String.raw`Let $B_3=(\mathcal P(\{1,2,3\}),\subseteq)$ be the Boolean lattice. A linear extension is a total ordering of its eight subsets in which $X$ appears before $Y$ whenever $X\subsetneq Y$.

How many linear extensions does $B_3$ have?`,
    hints: [
      'The empty set must be first and the full set must be last. Count orders of the six middle elements.',
      'Among the middle elements, the first two positions must both contain singleton sets.',
      'After choosing the first two singleton sets in order, either place the third singleton next or place the two-element set formed by the first two. Count the completions of these two cases separately.',
    ],
    solution: String.raw`The empty set is forced to be first, and $\{1,2,3\}$ is forced to be last. It remains to order the three singleton sets and the three two-element sets.

The first middle element must be a singleton, with $3$ choices. No two-element set is then available, because each requires both of its singleton subsets to appear first. Thus the second middle element is another singleton, with $2$ choices.

Fix this ordered choice of the first two singleton sets. At the next position there are exactly two available elements:

1. If the third singleton is chosen, all three two-element sets become available and can be ordered in $3!=6$ ways.
2. If the two-element set formed by the first two singletons is chosen, the third singleton is then forced. The remaining two two-element sets can be ordered in $2!=2$ ways.

Hence each ordered choice of the first two singleton sets has $6+2=8$ completions. The total number of linear extensions is
$$
3\cdot 2\cdot 8=48.
$$`,
    answer: {
      type: 'numeric',
      canonical: 48,
      display: '$48$',
    },
    related: ['bool-002', 'count-002'],
    estMinutes: 15,
  },
] satisfies readonly Problem[];
