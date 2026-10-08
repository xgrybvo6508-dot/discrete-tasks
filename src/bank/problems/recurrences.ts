import type { Problem } from '../types';

export const RECURRENCES_PROBLEMS = [
  {
    id: 'rec-001',
    source: 'bank',
    topic: 'recurrences',
    subtopics: ['coupled recurrences', 'parity', 'closed forms'],
    difficulty: 3,
    title: 'An even number of a’s',
    statement:
      'Let $n\\ge 0$. How many length-$n$ strings over the alphabet $\\{a,b,c\\}$ contain an even number of occurrences of $a$? The empty string is included when $n=0$.\n\nGive a closed formula in $n$.',
    hints: [
      'Let $E_n$ and $O_n$ count strings with an even and an odd number of $a$’s.',
      'Appending $b$ or $c$ preserves parity. Appending $a$ reverses it. Write coupled recurrences for $E_{n+1}$ and $O_{n+1}$.',
      'The sum $E_n+O_n$ counts every string. The difference $E_n-O_n$ has a particularly simple recurrence.',
    ],
    solution:
      'Let $E_n$ and $O_n$ be the numbers of length-$n$ strings with an even and an odd number of $a$’s, respectively. Appending $b$ or $c$ keeps the parity, while appending $a$ changes it. Therefore\n\n$$\nE_{n+1}=2E_n+O_n,\n\\qquad\nO_{n+1}=E_n+2O_n.\n$$\n\nThere is one empty string, and it has an even number of $a$’s, so $E_0=1$ and $O_0=0$. Adding the recurrences gives\n\n$$E_{n+1}+O_{n+1}=3(E_n+O_n),$$\n\nhence $E_n+O_n=3^n$. Subtracting them gives\n\n$$E_{n+1}-O_{n+1}=E_n-O_n,$$\n\nso $E_n-O_n=E_0-O_0=1$. Solving these two equations for $E_n$ yields\n\n$$\nE_n=\\frac{3^n+1}{2}.\n$$\n\nThis also gives $E_0=1$, as required.',
    answer: {
      type: 'expression',
      canonical: '(3^n + 1) / 2',
      display: '$\\displaystyle \\frac{3^n+1}{2}$',
      nRange: [0, 10],
    },
    estMinutes: 12,
  },
  {
    id: 'rec-002',
    source: 'bank',
    topic: 'recurrences',
    subtopics: ['tilings', 'linear recurrences', 'characteristic equations'],
    difficulty: 3,
    title: 'Dominoes and square tiles',
    statement:
      'Let $n\\ge 0$. A $2\\times n$ board is tiled with axis-aligned $1\\times2$ dominoes and $2\\times2$ square tiles. Tiles do not overlap, and every cell is covered. How many tilings are possible? The empty $2\\times0$ board has one tiling.\n\nGive a closed formula in $n$.',
    hints: [
      'Look at the tile or tiles that cover the leftmost column.',
      'A vertical domino leaves a smaller board of width $n-1$. A horizontal domino in the top-left cell forces another horizontal domino below it.',
      'The two ways to cover the first two columns lead to the same smaller width. Use the characteristic equation of the resulting recurrence.',
    ],
    solution:
      'Let $T_n$ be the number of tilings. If the leftmost column is covered by one vertical domino, the remaining board has width $n-1$. Otherwise, a horizontal domino covering the top-left cell forces a second horizontal domino below it, or one $2\\times2$ square covers the first two columns. Each of these two cases leaves a board of width $n-2$. Thus, for $n\\ge2$,\n\n$$\nT_n=T_{n-1}+2T_{n-2}.\n$$\n\nThe empty board has one tiling, so $T_0=1$. A $2\\times1$ board has only the vertical-domino tiling, so $T_1=1$.\n\nThe characteristic equation is\n\n$$r^2-r-2=(r-2)(r+1)=0.$$\n\nHence $T_n=A2^n+B(-1)^n$. The initial values give\n\n$$A+B=1,\n\\qquad\n2A-B=1.$$\n\nTherefore $A=2/3$ and $B=1/3$, and\n\n$$\nT_n=\\frac{2^{n+1}+(-1)^n}{3}.\n$$',
    answer: {
      type: 'expression',
      canonical: '(2^(n + 1) + (-1)^n) / 3',
      display: '$\\displaystyle \\frac{2^{n+1}+(-1)^n}{3}$',
      nRange: [0, 10],
    },
    related: ['comb-002'],
    estMinutes: 14,
  },
  {
    id: 'rec-003',
    source: 'bank',
    topic: 'recurrences',
    subtopics: ['generating functions', 'restricted multisets', 'coefficient extraction'],
    difficulty: 4,
    title: 'A constrained fruit multiset',
    statement:
      'Let $n\\ge 0$. A fruit multiset contains exactly $n$ fruits chosen from four types: apples, bananas, oranges, and pears. Fruits of the same type are indistinguishable. The number of apples must be even, the number of bananas must be a multiple of $5$, there may be at most $4$ oranges, and there may be at most $1$ pear.\n\nFind the number of such multisets as a closed formula in $n$.',
    hints: [
      'Write one ordinary generating function for the allowed count of each fruit type.',
      'The four factors are $1+x^2+x^4+\\cdots$, $1+x^5+x^{10}+\\cdots$, $1+x+\\cdots+x^4$, and $1+x$.',
      'Rewrite the finite factors as quotients. Every factor in the numerator cancels before coefficient extraction.',
      'After simplifying the product, use the standard power series for the reciprocal of a square.',
    ],
    solution:
      'The exponent of $x$ records the total number of fruits. The allowed counts for the four types give the ordinary generating function\n\n$$\nF(x)=\n(1+x^2+x^4+\\cdots)\n(1+x^5+x^{10}+\\cdots)\n(1+x+x^2+x^3+x^4)\n(1+x).\n$$\n\nAs formal power series,\n\n$$\nF(x)=\n\\frac{1}{1-x^2}\n\\frac{1}{1-x^5}\n\\frac{1-x^5}{1-x}\n\\frac{1-x^2}{1-x}\n=\\frac{1}{(1-x)^2}.\n$$\n\nThe cancellations are valid in formal power series because each denominator has constant term $1$ and is therefore invertible. Finally,\n\n$$\n\\frac{1}{(1-x)^2}=\\sum_{n\\ge0}(n+1)x^n.\n$$\n\nThus the coefficient of $x^n$, and hence the number of valid multisets of total size $n$, is\n\n$$n+1.$$\n\nThe formula includes $n=0$: the empty multiset is the unique valid multiset.',
    answer: {
      type: 'expression',
      canonical: 'n + 1',
      display: '$n+1$',
      nRange: [0, 10],
    },
    estMinutes: 16,
  },
] satisfies readonly Problem[];
