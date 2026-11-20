import test from 'node:test';
import assert from 'node:assert/strict';
import { answerProjectQuestion, classifyChatIntent } from './chatbot';
import { getAllProjectsForMonth } from './repository';

const { projects } = getAllProjectsForMonth('2026-03');

test('classifyChatIntent identifies greetings and small talk', () => {
  assert.equal(classifyChatIntent('Hi', projects), 'greeting');
  assert.equal(classifyChatIntent('Hello!', projects), 'greeting');
  assert.equal(classifyChatIntent('Hi there', projects), 'greeting');
  assert.equal(classifyChatIntent('How are you?', projects), 'greeting');
  assert.equal(classifyChatIntent('Hi, how are you?', projects), 'greeting');
  assert.equal(classifyChatIntent('Hello, how are you doing?', projects), 'greeting');
  assert.equal(classifyChatIntent('Good morning!', projects), 'greeting');
  assert.equal(classifyChatIntent('Thanks', projects), 'greeting');
});

test('classifyChatIntent identifies portal usage and risk-level questions', () => {
  assert.equal(classifyChatIntent('What do the risk levels mean?', projects), 'help');
  assert.equal(classifyChatIntent('How do I use the What-If Lab?', projects), 'help');
  assert.equal(classifyChatIntent('What does this portal do?', projects), 'help');
  assert.equal(classifyChatIntent('Difference between rule score and ML probability', projects), 'help');
});

test('classifyChatIntent flags short ambiguous queries for clarification', () => {
  assert.equal(classifyChatIntent('risk', projects), 'unclear');
  assert.equal(classifyChatIntent('projects', projects), 'unclear');
  assert.equal(classifyChatIntent('compare', projects), 'unclear');
});

test('classifyChatIntent routes concrete state, sector, and project queries to data', () => {
  assert.equal(classifyChatIntent('Maharashtra', projects), 'data');
  assert.equal(classifyChatIntent('How is Maharashtra performing?', projects), 'data');
  assert.equal(classifyChatIntent('Which Railways projects have high delay risk?', projects), 'data');
  assert.equal(classifyChatIntent('Explain PAI-RLY-104', projects, 'PAI-RLY-104'), 'data');
});

test('answerProjectQuestion responds naturally to greetings, help, unclear, and data queries without API key', async () => {
  const prevKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = '';
  try {
    const greeting = await answerProjectQuestion({
      question: 'Hi, how are you?',
      reportingMonth: '2026-03',
    });
    assert.equal(greeting.evidence.length, 0);
    assert.equal(greeting.modelUsed, 'conversational-router');
    assert.ok(!greeting.answer.toLowerCase().includes('portfolio totals'));

    const help = await answerProjectQuestion({
      question: 'What do the risk levels mean?',
      reportingMonth: '2026-03',
    });
    assert.equal(help.evidence.length, 0);
    assert.ok(help.answer.includes('Rule-Based Risk Score'));
    assert.ok(help.answer.includes('Critical'));

    const unclear = await answerProjectQuestion({
      question: 'risk',
      reportingMonth: '2026-03',
    });
    assert.equal(unclear.evidence.length, 0);
    assert.ok(unclear.answer.includes('?'));

    const dataReply = await answerProjectQuestion({
      question: 'How is Maharashtra performing?',
      reportingMonth: '2026-03',
    });
    assert.ok(dataReply.evidence.length > 0);
    assert.ok(dataReply.answer.includes('Maharashtra'));
    assert.ok(dataReply.evidence.every((e) => e.state === 'Maharashtra'));
  } finally {
    if (prevKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = prevKey;
    }
  }
});
