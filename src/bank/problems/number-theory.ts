import type { Problem } from '../types';

export const NUMBER_THEORY_PROBLEMS = [
  {
    id: 'nt-001',
    source: 'bank',
    topic: 'number-theory',
    subtopics: ['Chinese remainder theorem', 'prime powers', 'quadratic congruences'],
    difficulty: 4,
    title: 'Square roots of one modulo 1000',
    statement: String.raw`How many residue classes $x \in \mathbb{Z}_{1000}$ satisfy
$$
x^2 \equiv 1 \pmod{1000}?
$$`,
    hints: [
      String.raw`Factor $1000$ into coprime prime powers.`,
      String.raw`Use the Chinese remainder theorem. A solution modulo $1000$ corresponds to one solution for each prime-power factor.`,
      String.raw`Modulo $8$, examine the odd residues. Modulo $125$, use $125 \mid (x-1)(x+1)$ and the fact that $\gcd(x-1,x+1)$ divides $2$.`,
    ],
    solution: String.raw`Factor the modulus as
$$
1000=8\cdot125,
$$
where $\gcd(8,125)=1$. By the Chinese remainder theorem, solutions modulo $1000$ are in bijection with pairs consisting of a solution modulo $8$ and a solution modulo $125$.

A square is congruent to $1$ modulo $8$ exactly when its residue is odd. Thus the solutions modulo $8$ are
$$
1,3,5,7,
$$
so there are four.

Now suppose $x^2\equiv1\pmod{125}$. Then
$$
125\mid(x-1)(x+1).
$$
The two factors differ by $2$, so their greatest common divisor divides $2$. In particular, they cannot both be divisible by $5$. Therefore all three factors of $5$ in $125=5^3$ must divide the same factor. Hence
$$
x\equiv1\pmod{125}
\quad\text{or}\quad
x\equiv-1\pmod{125}.
$$
Both residues work, so there are two solutions modulo $125$.

The Chinese remainder theorem combines every one of the four choices modulo $8$ with every one of the two choices modulo $125$, and each pair gives one residue modulo $1000$. Therefore the number of solutions is
$$
4\cdot2=8.
$$`,
    answer: {
      type: 'numeric',
      canonical: 8,
      display: '$8$',
    },
    related: ['nt-003'],
    estMinutes: 18,
  },
  {
    id: 'nt-002',
    source: 'bank',
    topic: 'number-theory',
    subtopics: ['modular exponentiation', 'multiplicative order', 'periodicity'],
    difficulty: 3,
    title: 'Last two digits of a large power',
    statement: String.raw`Find the last two decimal digits of $7^{2026}$. Give the answer as an integer from $0$ to $99$.`,
    hints: [
      String.raw`The last two digits are determined by the residue modulo $100$.`,
      String.raw`Compute the first few powers of $7$ modulo $100$ and look for a return to $1$.`,
      String.raw`Once a period is known, reduce $2026$ modulo that period before evaluating the remaining small power.`,
    ],
    solution: String.raw`We work modulo $100$. A short computation gives
$$
7^2=49
$$
and
$$
7^4=49^2=2401\equiv1\pmod{100}.
$$
Since
$$
2026=4\cdot506+2,
$$
we obtain
$$
7^{2026}=(7^4)^{506}7^2\equiv1^{506}\cdot49\equiv49\pmod{100}.
$$
Therefore the last two decimal digits are $49$.`,
    answer: {
      type: 'numeric',
      canonical: 49,
      display: '$49$',
    },
    related: ['ind-003'],
    estMinutes: 10,
  },
  {
    id: 'nt-003',
    source: 'bank',
    topic: 'number-theory',
    subtopics: ['unit groups', 'primitive roots', 'cyclic groups'],
    difficulty: 4,
    title: 'Cyclic unit groups',
    statement: String.raw`For a positive integer $n$, let $\mathbb{Z}_n^{*}$ be the group of invertible residue classes modulo $n$ under multiplication. For $n=1$, use the conventional trivial unit group.

Determine the set of all integers $n$ with $1\le n\le30$ for which $\mathbb{Z}_n^{*}$ is cyclic.`,
    hints: [
      String.raw`This asks exactly which moduli admit a primitive root.`,
      String.raw`Use the classification theorem: a positive integer admits a primitive root precisely when it is $1$, $2$, $4$, $p^k$, or $2p^k$, where $p$ is an odd prime and $k\ge1$.`,
      String.raw`List the odd prime powers at most $30$, then include their doubles when the double is still in range. Treat the exceptional small moduli separately.`,
    ],
    solution: String.raw`The primitive-root classification states that $\mathbb{Z}_n^{*}$ is cyclic exactly for
$$
n=1,\quad n=2,\quad n=4,\quad n=p^k,\quad\text{or}\quad n=2p^k,
$$
where $p$ is an odd prime and $k\ge1$.

The odd prime powers at most $30$ are
$$
3,5,7,9,11,13,17,19,23,25,27,29.
$$
Among their doubles, the values still at most $30$ are
$$
6,10,14,18,22,26.
$$
Adding the exceptional moduli $1,2,4$ and sorting gives
$$
\{1,2,3,4,5,6,7,9,10,11,13,14,17,18,19,22,23,25,26,27,29\}.
$$

Every listed modulus has one of the classified forms, so its unit group is cyclic. Every omitted integer from $1$ through $30$ has none of those forms, so its unit group is not cyclic. This proves both inclusion directions.`,
    answer: {
      type: 'set',
      canonical: [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 13, 14, 17, 18, 19, 22, 23, 25, 26, 27, 29],
      display: String.raw`$\{1,2,3,4,5,6,7,9,10,11,13,14,17,18,19,22,23,25,26,27,29\}$`,
    },
    related: ['nt-001'],
    estMinutes: 22,
  },
] satisfies readonly Problem[];
