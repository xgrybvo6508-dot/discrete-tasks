import { TOPIC_EDGES, TOPIC_LABELS, TOPIC_POSITIONS, TOPICS } from '../../../bank/topics';
import type { Topic } from '../../../bank/types';
import { h } from '../../../lib/dom';
import { bandOf, BAND_LABELS } from '../../../memory/mastery';
import type { Memory } from '../../../memory/schema';

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Readonly<Record<string, string>>,
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  return el;
}

export function topicMap(
  memory: Memory,
  selected: Topic | null,
  onSelect: (topic: Topic) => void,
): HTMLElement {
  const map = svg('svg', {
    class: 'topic-map',
    viewBox: '0 0 1000 620',
    role: 'group',
    'aria-labelledby': 'topic-map-title topic-map-desc',
  });
  const title = svg('title', { id: 'topic-map-title' });
  title.textContent = 'Discrete mathematics topic map';
  const desc = svg('desc', { id: 'topic-map-desc' });
  desc.textContent = 'Connected topics. Select a topic to see its problems.';
  map.append(title, desc);
  for (const [from, to] of TOPIC_EDGES) {
    const a = TOPIC_POSITIONS[from];
    const b = TOPIC_POSITIONS[to];
    map.append(
      svg('line', {
        class: 'topic-map__edge',
        x1: String(a.x),
        y1: String(a.y),
        x2: String(b.x),
        y2: String(b.y),
      }),
    );
  }
  for (const topic of TOPICS) {
    const position = TOPIC_POSITIONS[topic];
    const band = bandOf(memory.topics[topic].mastery);
    const group = svg('g', {
      class: `topic-node topic-node--${band}${selected === topic ? ' is-selected' : ''}`,
      role: 'button',
      tabindex: '0',
      'aria-label': `${TOPIC_LABELS[topic]}, ${BAND_LABELS[band]}`,
      'aria-pressed': String(selected === topic),
      transform: `translate(${position.x} ${position.y})`,
    });
    group.append(svg('rect', { x: '-105', y: '-43', width: '210', height: '86', rx: '16' }));
    const label = svg('text', { class: 'topic-node__label', x: '0', y: '-5' });
    label.textContent = TOPIC_LABELS[topic];
    const status = svg('text', { class: 'topic-node__band', x: '0', y: '23' });
    status.textContent = BAND_LABELS[band];
    group.append(label, status);
    group.addEventListener('click', () => onSelect(topic));
    group.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect(topic);
      }
    });
    map.append(group);
  }

  const list = h('div', { class: 'topic-list', 'aria-label': 'Topics' });
  for (const topic of TOPICS) {
    const band = bandOf(memory.topics[topic].mastery);
    const button = h(
      'button',
      {
        class: `topic-list__item${selected === topic ? ' is-selected' : ''}`,
        type: 'button',
        'aria-pressed': String(selected === topic),
      },
      [
        h('span', {}, [TOPIC_LABELS[topic]]),
        h('span', { class: `band band--${band}` }, [BAND_LABELS[band]]),
      ],
    );
    button.addEventListener('click', () => onSelect(topic));
    list.append(button);
  }
  return h('div', { class: 'topic-map-wrap' }, [map, list]);
}
