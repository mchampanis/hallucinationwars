---
name: research
description: Improve fact accuracy and reduce hallucinations during research tasks.
disable-model-invocation: true
---

Research topic: $ARGUMENTS

- If you're unsure about any aspect of my question, or don't have the relevant knowledge, then you are allowed to tell me that you don't know.
- Extract exact quotes from research material that are most relevant to my question. If you can't find anything relevant, state "No exact quotes found on this topic."
- After drafting, review each claim in your answer. For each claim, find a direct quote from the research that supports it.
- Chain-of-thought verification: explain your reasoning step-by-step before giving a final answer.
