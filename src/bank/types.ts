export type Topic =
  | 'combinatorics'
  | 'graphs'
  | 'logic'
  | 'sets'
  | 'relations'
  | 'induction'
  | 'recurrences'
  | 'boolean'
  | 'number-theory'
  | 'counting-principles';

export type AnswerType = 'numeric' | 'expression' | 'set' | 'proof';

export type Difficulty = 3 | 4 | 5;

export interface Answer {
  type: AnswerType;
  /** Required unless the type is 'proof'. */
  canonical?: number | string | Array<number | string>;
  /** Human-readable final answer (LaTeX allowed). */
  display: string;
  /** Extra accepted inputs. For 'set' answers these are item aliases written as "alias=item". */
  accepted?: string[];
  /** Numeric only, and only for genuinely non-rational answers. */
  tolerance?: number;
  /** Expression only; default [1, 10]. */
  nRange?: [number, number];
  /** Required for 'proof': claims a correct proof must establish. */
  keyPoints?: string[];
}

export interface Problem {
  /** '<prefix>-<nnn>' for bank problems, 'ai-<prefix>-<base36>' for AI problems. */
  id: string;
  source: 'bank' | 'ai';
  topic: Topic;
  subtopics?: string[];
  difficulty: Difficulty;
  title: string;
  /** Markdown + KaTeX. */
  statement: string;
  hints: [string, string, string] | [string, string, string, string];
  solution: string;
  answer: Answer;
  related?: string[];
  estMinutes?: number;
}
