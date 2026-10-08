import 'katex/dist/katex.min.css';
import './ui/tokens.css';
import './ui/base.css';
import { mountApp } from './ui/app';

const container = document.getElementById('app');
if (container) mountApp(container);
