import type { Problem } from '../types';

export const LOGIC_PROBLEMS = [
  {
    id: 'logic-001',
    source: 'bank',
    topic: 'logic',
    subtopics: ['propositional logic', 'implication', 'satisfiability'],
    difficulty: 3,
    title: 'An implication chain',
    statement:
      'Each variable $x_1,\\ldots,x_{10}$ is either false or true. How many truth assignments satisfy\n\n$$\n(x_1\\to x_2)\\land(x_2\\to x_3)\\land\\cdots\\land(x_9\\to x_{10})?\n$$',
    hints: [
      'Recall the only pair of truth values that makes an implication false.',
      'Read the variables from left to right. Once one variable is true, what must happen to every later variable?',
      'Describe every satisfying assignment by the position of a single cut between an initial block and a final block.',
    ],
    solution:
      'An implication $x_i\\to x_{i+1}$ is false exactly when $x_i$ is true and $x_{i+1}$ is false. Therefore a satisfying assignment cannot contain a true value followed later by a false value: the first such change would include an adjacent true-false pair.\n\nHence every satisfying assignment has the form\n\n$$\n\\underbrace{0\\cdots 0}_{k}\\underbrace{1\\cdots 1}_{10-k}\n$$\n\nfor a unique $k\\in\\{0,1,\\ldots,10\\}$. Conversely, every assignment of this form satisfies each implication, because none has antecedent true and consequent false. There are therefore $11$ satisfying assignments.',
    answer: {
      type: 'numeric',
      canonical: 11,
      display: '$11$',
    },
    related: ['bool-002'],
    estMinutes: 8,
  },
  {
    id: 'logic-002',
    source: 'bank',
    topic: 'logic',
    subtopics: ['predicate logic', 'quantifiers', 'binary relations'],
    difficulty: 3,
    title: 'A witness in every row',
    statement:
      'Let $n\\ge 1$ and $[n]=\\{1,\\ldots,n\\}$. A binary relation $R$ on $[n]$ is any subset of $[n]\\times[n]$. Find, as a function of $n$, the number of relations satisfying\n\n$$\n\\forall x\\in[n]\\;\\exists y\\in[n]\\;R(x,y).\n$$',
    hints: [
      'Represent a relation by its $n\\times n$ zero-one matrix.',
      'For one fixed value of $x$, the quantified condition says that its row is not empty.',
      'Count the permitted patterns for one row. The rows can then be chosen independently.',
    ],
    solution:
      'Represent $R$ by a matrix whose entry in row $x$ and column $y$ is $1$ exactly when $R(x,y)$ holds. The formula says that every row contains at least one $1$.\n\nA row has $2^n$ possible zero-one patterns. Exactly one, the all-zero pattern, is forbidden, so each row has $2^n-1$ choices. Conditions on different rows share no entries, so their choices are independent. Since there are $n$ labelled rows, the number of relations is\n\n$$\n(2^n-1)^n.\n$$',
    answer: {
      type: 'expression',
      canonical: '(2^n - 1)^n',
      display: '$(2^n-1)^n$',
      nRange: [1, 10],
    },
    estMinutes: 10,
  },
  {
    id: 'logic-003',
    source: 'bank',
    topic: 'logic',
    subtopics: ['predicate logic', 'quantifier laws', 'logical validity'],
    difficulty: 4,
    title: 'Which quantifier laws are valid?',
    statement:
      'Work in classical first-order logic. Every structure has a nonempty domain $U$, arbitrary unary predicates $P,Q\\subseteq U$, and an arbitrary binary relation $R\\subseteq U\\times U$.\n\nSelect exactly the labels of the formulas that are true in every such structure.\n\n- **A.** $\\forall x\\,(P(x)\\land Q(x))\\;\\Longleftrightarrow\\;(\\forall x\\,P(x))\\land(\\forall x\\,Q(x))$\n- **B.** $\\exists x\\,(P(x)\\lor Q(x))\\;\\Longleftrightarrow\\;(\\exists x\\,P(x))\\lor(\\exists x\\,Q(x))$\n- **C.** $\\forall x\\,(P(x)\\lor Q(x))\\;\\Longleftrightarrow\\;(\\forall x\\,P(x))\\lor(\\forall x\\,Q(x))$\n- **D.** $\\exists x\\,(P(x)\\land Q(x))\\;\\Longleftrightarrow\\;(\\exists x\\,P(x))\\land(\\exists x\\,Q(x))$\n- **E.** $\\neg\\forall x\\,P(x)\\;\\Longleftrightarrow\\;\\exists x\\,\\neg P(x)$\n- **F.** $\\forall x\\,\\exists y\\,R(x,y)\\;\\Longrightarrow\\;\\exists y\\,\\forall x\\,R(x,y)$',
    hints: [
      'For each biconditional, check the two directions separately. A shared witness and separate witnesses are not the same thing.',
      'Universal quantification naturally distributes over conjunction. Existential quantification naturally distributes over disjunction.',
      'For formulas involving $P$ and $Q$, test a two-element domain where the predicates hold at different elements.',
      'For the last formula, try a relation in which each $x$ has a witness chosen specifically for that $x$.',
    ],
    solution:
      '**A is valid.** If every element satisfies both predicates, then every element satisfies $P$ and every element satisfies $Q$. Conversely, if every element satisfies $P$ and every element satisfies $Q$, then every element satisfies both.\n\n**B is valid.** If some element satisfies $P(x)\\lor Q(x)$, then it satisfies at least one disjunct, so at least one existential on the right holds. Conversely, a witness for either existential is a witness for the disjunction.\n\n**E is valid.** The statement that not every element satisfies $P$ means exactly that some element does not satisfy $P$. This is the classical quantifier-negation law.\n\nIt remains to show that the other formulas are not valid. For **C** and **D**, take $U=\\{1,2\\}$, $P=\\{1\\}$, and $Q=\\{2\\}$. Every element is in $P\\cup Q$, so the left side of C is true, but neither predicate holds for every element, so its right side is false. Both $P$ and $Q$ are nonempty, so the right side of D is true, but $P\\cap Q$ is empty, so its left side is false.\n\nFor **F**, take $U=\\{1,2\\}$ and $R=\\{(1,1),(2,2)\\}$. Each $x$ is related to some $y$, namely itself, so the antecedent is true. No one value of $y$ is related to both values of $x$, so the consequent is false.\n\nThus the valid labels are exactly $\\{A,B,E\\}$.',
    answer: {
      type: 'set',
      canonical: ['A', 'B', 'E'],
      display: '$\\{A,B,E\\}$',
    },
    estMinutes: 18,
  },
] satisfies readonly Problem[];
