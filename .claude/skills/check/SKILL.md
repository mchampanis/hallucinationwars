---
name: check
description: Review code for bugs, code smells, dead code, and general correctness.
disable-model-invocation: true
---

- If you're unsure about any aspect of the project, or don't have the relevant knowledge, then you are allowed to tell me that you don't know.
- Do your best work - time and effort are not a consideration, merely the best outcome.
- Use a sub-agent with a fresh context to get independent verification. Have it report to you and allow it to fix issues if its chain-of-thought is correct.
- Echo relevant sub-agent feedback/points to main console, i.e. surface them so I have context on what you are discussing internally.
- Do not leave the project directory.
- Review all files in the project, including documentation, memories, issue lists, and anything else relevant.
- Analyse source code for faulty logic, bugs, code smells, documentation issues, dead code, and mismatches between code behaviour and what documentation describes.
- Before reporting a bug, trace through the logic step-by-step to confirm it is actually a bug and that your proposed fix is correct.
- If something is outside of your knowledge base, do research on the internet to expand your knowledge and/or to find a solution.
- Fix any issues found as best as possible, sensibly and logically, following best coding practices.
- Present a succinct report of your findings afterwards.
- As your last message, print a short and sensible git commit message for any changes that were made.
