---
name: feature
description: Build a feature end to end - interview the user until requirements are clear, write a spec, plan milestones, then build and review one milestone at a time with a check-in between each. Use when the user runs /feature or asks to build a new feature.
---

# Feature workflow

You are the orchestrator. Only you talk to the user; the subagents cannot. Do each phase in order and do not skip the stops.

The idea to build: $ARGUMENTS

## Phase 1: Interview (stop until clear)

Goal: no guessing later. Before asking anything, read CLAUDE.md and skim the related code so you do not ask what the code already answers.

Ask with the AskUserQuestion tool, a few questions per round, each with concrete options and your recommended one first. Cover:

- Who uses this and what they are trying to get done.
- The exact behaviour: inputs, outputs, each screen or endpoint.
- Data: what is stored, relations to existing models, what happens to existing rows.
- Access: who may see or do it.
- Edge cases: empty, invalid, duplicate, failure of an external call.
- What is explicitly out of scope for now.

Keep asking rounds until every branch is settled. Then write `docs/specs/<feature-slug>.md` with: goal, user-facing behaviour, data model changes, access rules, edge cases, out of scope, and acceptance criteria as a checklist. Show the user a short summary and ask them to confirm the spec. Do not continue until they do.

## Phase 2: Plan (stop for approval)

Create a branch `feature/<feature-slug>`. Give the spec path to the `planner` agent. When it returns:

- Put its open questions to the user and write the answers into the spec.
- Show the milestone list and the risks, and ask for approval. Apply any changes the user wants.

## Phase 3: Build loop (one milestone at a time)

For each milestone, in order:

1. Send the spec path and that milestone's full text to the `implementer` agent.
2. If it reports a question for the user, ask it now, record the answer in the spec, and send the implementer back in.
3. Send the spec path and milestone text to the `reviewer` agent.
4. For every **must fix** finding, send the implementer back with the findings, then review again. At most three rounds; if it still fails, stop and show the user what is stuck.
5. Run type check, lint and tests yourself. Only when they pass, commit with a message describing the milestone.
6. **Check-in**: tell the user in a few lines what was built, how to try it, and anything the reviewer flagged as optional. Then ask what is next: continue to the next milestone as planned, change something first, or adjust the remaining plan. Wait for the answer.

Work through steps 1 to 5 without interrupting the user unless a real product question comes up. The check-in in step 6 is the planned stop.

## Phase 4: Finish

When all milestones are done, go through the acceptance criteria in the spec one by one and state for each whether it is met and how you verified it. List anything not done. Do not merge or push; ask the user what they want to do with the branch.
