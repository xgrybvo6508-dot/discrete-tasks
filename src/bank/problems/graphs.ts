import type { Problem } from '../types';

export const GRAPH_PROBLEMS = [
  {
    id: 'graph-001',
    source: 'bank',
    topic: 'graphs',
    subtopics: ['labelled trees', 'Prüfer codes', 'vertex degrees'],
    difficulty: 4,
    title: 'A prescribed leaf',
    statement:
      'How many simple labelled trees on the vertex set $\\{1,2,3,4,5,6,7\\}$ have vertex $1$ as a leaf?',
    hints: [
      'Encode a labelled tree on seven vertices by its Prüfer sequence.',
      'In a Prüfer sequence, a vertex occurs exactly one fewer time than its degree in the tree.',
      'Translate the condition that vertex $1$ is a leaf into a restriction on the five entries of the sequence.',
    ],
    solution:
      'A labelled tree on seven vertices has a unique Prüfer sequence of length $7-2=5$, and every sequence of length $5$ over the seven vertex labels represents one such tree.\n\nFor each vertex $v$, its degree in the tree equals one plus the number of occurrences of $v$ in the Prüfer sequence. Thus vertex $1$ is a leaf exactly when the label $1$ does not occur in the sequence.\n\nEach of the five positions may therefore contain any of the six labels $2,3,4,5,6,7$, independently. The required number is\n\n$$6^5=7776.$$',
    answer: {
      type: 'numeric',
      canonical: 7776,
      display: '$7776$',
    },
    related: ['graph-002'],
    estMinutes: 12,
  },
  {
    id: 'graph-002',
    source: 'bank',
    topic: 'graphs',
    subtopics: ['spanning trees', 'complete bipartite graphs', 'structural counting'],
    difficulty: 4,
    title: 'Spanning trees of a complete bipartite graph',
    statement:
      'Let $n\\ge 1$. The complete bipartite graph $K_{2,n}$ has labelled parts $\\{a,b\\}$ and $\\{v_1,\\ldots,v_n\\}$. Find a closed formula in $n$ for its number of spanning trees.',
    hints: [
      'Every vertex $v_i$ has degree $1$ or $2$ in a spanning tree because it is adjacent only to $a$ and $b$.',
      'A spanning tree has $n+1$ edges. If $r$ of the vertices $v_i$ have degree $2$, count its edges using the degrees of the $v_i$.',
      'Determine the one vertex that joins both $a$ and $b$. For every other $v_i$, choose which of $a$ and $b$ it joins.',
    ],
    solution:
      'Let $T$ be a spanning tree of $K_{2,n}$. Each $v_i$ must have degree at least $1$ in $T$, and it can have degree at most $2$. Suppose exactly $r$ of the vertices $v_i$ have degree $2$. Since every edge has exactly one endpoint in $\\{v_1,\\ldots,v_n\\}$, summing degrees over this part counts every edge once. Hence\n\n$$|E(T)|=(n-r)+2r=n+r.$$\n\nThe tree has $n+2$ vertices, so it has $n+1$ edges. Therefore $r=1$.\n\nChoose the unique vertex $v_i$ of degree $2$ in $n$ ways; both $av_i$ and $bv_i$ must be present. Each of the remaining $n-1$ vertices has degree $1$, and independently chooses its neighbour, either $a$ or $b$. This gives $2^{n-1}$ choices.\n\nEvery graph constructed this way is connected: the degree-$2$ vertex connects $a$ to $b$, and every other vertex attaches to one of them. It has $n+1$ edges on $n+2$ vertices, so it is a tree. Thus the number of spanning trees is\n\n$$n2^{n-1}.$$',
    answer: {
      type: 'expression',
      canonical: 'n * 2^(n - 1)',
      display: '$\\displaystyle n2^{n-1}$',
      nRange: [1, 15],
    },
    related: ['graph-001'],
    estMinutes: 15,
  },
  {
    id: 'graph-003',
    source: 'bank',
    topic: 'graphs',
    subtopics: ['tournaments', 'Hamiltonian paths', 'induction'],
    difficulty: 4,
    title: 'A path through every tournament',
    statement:
      'A **tournament** is a finite directed graph in which, for every two distinct vertices $u$ and $v$, exactly one of the directed edges $u\\to v$ and $v\\to u$ is present. Prove that every tournament has a Hamiltonian path: an ordering $v_1,v_2,\\ldots,v_n$ of all its vertices such that $v_i\\to v_{i+1}$ for every $1\\le i<n$.',
    hints: [
      'Use induction on the number of vertices. Remove one vertex $x$ and take a Hamiltonian path in the remaining tournament.',
      'Try to insert $x$ somewhere into the directed path $v_1\\to v_2\\to\\cdots\\to v_{n-1}$. Consider first whether $x\\to v_1$.',
      'Otherwise, look for the first vertex $v_i$ on the path such that $x\\to v_i$. What is the direction of the edge between $v_{i-1}$ and $x$? Also handle the case when no such $v_i$ exists.',
    ],
    solution:
      'We prove the claim by induction on the number $n$ of vertices.\n\nFor $n=1$, the single vertex is a Hamiltonian path. Now let $n\\ge 2$ and assume every tournament on $n-1$ vertices has a Hamiltonian path. Choose a vertex $x$ and remove it. By the induction hypothesis, the remaining tournament has a path\n\n$$v_1\\to v_2\\to\\cdots\\to v_{n-1}$$\n\ncontaining all its vertices.\n\nIf $x\\to v_1$, prepend $x$ to this path. Otherwise, suppose there is an index $i$ with $x\\to v_i$, and choose the smallest such $i$. Then $i>1$. By minimality, $x\\not\\to v_{i-1}$; because the graph is a tournament, this means $v_{i-1}\\to x$. We may therefore insert $x$ between $v_{i-1}$ and $v_i$:\n\n$$v_1\\to\\cdots\\to v_{i-1}\\to x\\to v_i\\to\\cdots\\to v_{n-1}.$$\n\nFinally, if there is no index $i$ with $x\\to v_i$, then $v_i\\to x$ for every $i$, so append $x$ after $v_{n-1}$.\n\nIn every case we obtain a directed path containing all $n$ vertices exactly once. The induction is complete.',
    answer: {
      type: 'proof',
      display: 'Every finite tournament has a Hamiltonian path.',
      keyPoints: [
        'Uses induction on the number of vertices, with the one-vertex case.',
        'Removes one vertex and applies the induction hypothesis to obtain a path through all remaining vertices.',
        'Inserts the removed vertex before the first path vertex that it dominates, with the edge directions justified.',
        'Handles both endpoint cases: prepending the vertex and appending it when no insertion point exists.',
      ],
    },
    estMinutes: 18,
  },
] satisfies readonly Problem[];
