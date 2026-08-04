import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assistantEvaluationBank } from './asistente.evals.js';
import { selectAssistantTool } from './asistente.tools.js';

describe('banco de evaluacion del asistente', () => {
  it('mantiene cien solicitudes representativas con identificadores unicos', () => {
    assert.equal(assistantEvaluationBank.length, 100);
    assert.equal(new Set(assistantEvaluationBank.map((item) => item.id)).size, 100);
  });

  for (const evaluation of assistantEvaluationBank) {
    it(`${evaluation.id} clasifica ${evaluation.categoria}`, () => {
      assert.equal(
        selectAssistantTool(evaluation.input).name,
        evaluation.herramienta_esperada,
        evaluation.input.mensaje
      );
    });
  }
});
