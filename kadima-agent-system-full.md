# Kadima Agent System

Complete End to End Specification for the Agent Layer

## 1. Purpose

This document defines the full architecture of the Kadima agent layer.\
The agent layer represents the digital workforce that builds software
products for users.

Users do not write code directly.\
Instead they assemble a team of AI agents that behave like professionals
in a software company.

Each agent behaves like an employee with:

identity\
professional role\
skills\
system prompt\
work style\
model tier\
capacity\
performance history

Agents accumulate experience over time and improve their market value.

This document covers:

agent identity\
agent generation\
agent DNA model\
system prompt generation\
skills generation\
memory model\
pricing model\
capacity model\
hiring model\
marketplace representation\
scheduler interaction\
JSON schemas

------------------------------------------------------------------------

# 2. Core Concepts

## 2.1 Agent

An agent is a persistent professional entity.

Agent is not a single model call.

Agent = professional identity\
Runtime = execution instance

Example

Agent ID: 2116\
Name: Daniel Carter\
Role: Frontend Architect\
Model Tier: Advanced\
Capacity: 10 units

The runtime that executes a task can be created many times for the same
agent.

------------------------------------------------------------------------

## 2.2 Roles

Each agent has exactly one role.

Initial roles in the system:

Product Manager\
Architect\
Engineer\
QA\
DevOps\
Security\
Documentation

Roles define the responsibilities and default system prompt templates.

------------------------------------------------------------------------

## 2.3 Specialties

Roles contain specialties.

Architect

Backend Architect\
Frontend Architect\
Mobile Architect\
Data Architect\
Infrastructure Architect

Engineer

Backend Engineer\
Frontend Engineer\
Mobile Engineer\
ML Engineer\
Infrastructure Engineer

QA

Test Engineer\
Automation Engineer\
Performance QA

------------------------------------------------------------------------

# 3. Agent Identity Model

Every agent has a persistent identity stored in the database.

AgentProfile schema

id\
name\
role\
specialty\
model_tier\
system_prompt\
skills\
dna_profile\
capacity_units\
utilization_units\
base_price\
performance_multiplier\
success_rate\
avg_iterations\
projects_completed\
created_at

------------------------------------------------------------------------

# 4. Agent DNA Model

Agent DNA creates personality and uniqueness between agents.

Two agents with identical roles may behave differently because their DNA
differs.

DNA Fields

work_style\
communication_style\
risk_appetite\
strength_bias\
tooling_bias\
failure_strategy

Example DNA

work_style: pragmatic_builder\
communication_style: concise\
risk_appetite: balanced\
strength_bias: performance\
tooling_bias: testing_first\
failure_strategy: isolate_then_fix

DNA influences

system prompt structure\
skill emphasis\
task execution strategy\
retry behavior

------------------------------------------------------------------------

# 5. Agent Generator System

The system contains an internal service responsible for generating new
agents.

Agent generation is deterministic based on seeds.

## 5.1 Inputs

role\
specialty\
model_tier

## 5.2 Generation Pipeline

Step 1 generate agent name\
Step 2 generate DNA profile\
Step 3 generate skills\
Step 4 generate system prompt\
Step 5 assign capacity\
Step 6 assign base price\
Step 7 store agent profile

Output is AgentProfile JSON.

------------------------------------------------------------------------

# 6. American Name Generation

Agents receive names that sound like real American professionals.

Names must not represent real individuals.

Names are created using two name banks.

First names example

Daniel\
Ethan\
Lucas\
Ryan\
Nathan\
Adam\
Jason\
Oliver\
Jack\
Connor

Last names example

Carter\
Walker\
Bennett\
Mitchell\
Brooks\
Foster\
Hayes\
Parker\
Sullivan\
Reed

Name generation formula

random(first_name_bank) + random(last_name_bank)

Example generated agents

Daniel Carter\
Ryan Mitchell\
Ethan Walker\
Lucas Bennett\
Nathan Brooks

The name is permanent once assigned.

------------------------------------------------------------------------

# 7. Skills Generation

Skills are generated from three layers.

## 7.1 Core Skills

Defined by role.

Example Architect core skills

system architecture\
scalability planning\
dependency management\
system decomposition

## 7.2 Specialty Skills

Defined by specialty.

Example Frontend Architect

react architecture\
component design\
state management\
render optimization

## 7.3 Personal Strength Skills

Derived from DNA.

Example

design systems\
type driven architecture\
performance profiling\
testing strategy

Final skill list merges all three layers.

------------------------------------------------------------------------

# 8. System Prompt Generator

System prompts are generated using structured templates.

Prompt structure

Identity\
Mission\
Constraints\
Operating Procedure\
Quality Bar\
Escalation Rules

Example identity block

You are a Frontend Architect specializing in scalable React
applications.\
Your primary objective is to design maintainable systems and prevent
unnecessary complexity.

Example operating procedure

1 Understand the task contract\
2 Plan architecture steps\
3 Generate solution\
4 Self review output\
5 Deliver structured response

Prompts are deterministic based on DNA.

------------------------------------------------------------------------

# 9. Capacity Model

Agents operate using capacity units.

Capacity represents parallel work ability.

Example

Agent capacity = 10 units

Project allocation

small project = 2 units\
medium project = 4 units\
large project = 7 units

Agents can participate in multiple projects simultaneously until
capacity is full.

------------------------------------------------------------------------

# 10. Pricing Model

## 10.1 Tiers

Tier 1 — lightweight models\
Tier 2 — standard reasoning models\
Tier 3 — advanced reasoning models\
Tier 4 — premium reasoning models

## 10.2 Base Price

Base price is derived from two components.

Model cost\
The underlying cost of running the agent's model tier.

Platform commission\
A fixed percentage added on top of model cost.

Base Price = Model Cost + Platform Commission

## 10.3 Performance Multiplier

At system launch all agents start at Performance Multiplier = 1.0

After accumulated work history the multiplier is adjusted based on

success_rate\
projects_completed\
avg_iterations\
current utilization

High demand agents with strong records earn a multiplier above 1.0.\
Underperforming agents earn a multiplier below 1.0.

Final Price = Base Price * Performance Multiplier

## 10.4 Price Configurability

Pricing components must be independently configurable without code changes.

Configurable components

model cost per tier\
commission rate\
multiplier calculation weights\
multiplier floor and ceiling

------------------------------------------------------------------------

# 11. Performance Metrics

Agent performance evolves over time.

Metrics tracked

tasks_completed\
success_rate\
avg_iterations\
gate_pass_rate\
execution_time

These metrics influence price and ranking.

------------------------------------------------------------------------

# 12. Agent Memory System

## 12.1 Memory Types

There are exactly two memory types.

Project Memory\
Local to a single project. Contains context, decisions, and files. Never
leaves the project boundary.

Professional Memory\
Global to the agent. Contains only abstract patterns with no code, no
file names, and no identifying data. This section covers Professional
Memory only.

------------------------------------------------------------------------

## 12.2 Learning Events

A learning candidate is created when any of the following occurs.

Gate failure\
Build failed or tests failed.

Review required structural change\
Reviewer changed strategy or solution structure.

Excessive iterations\
More than N iterations to reach a solution.

Exceptional improvement\
Solution dramatically reduced time or complexity.

LearningCandidate schema

event_id\
agent_id\
task_type\
context_signature\
failure_signals\
resolution_summary\
iteration_count\
timestamp

LearningCandidates do not enter memory directly.

------------------------------------------------------------------------

## 12.3 Reflector

The Reflector is a dedicated component that converts LearningCandidates
into abstract patterns.

The Reflector performs three operations.

Remove identifying information\
Generalize the problem and resolution\
Produce a standard PatternRecord

This prevents leakage of project data into global memory.

------------------------------------------------------------------------

## 12.4 PatternRecord

PatternRecord schema

pattern_id\
problem_type\
signals\
context_signature\
fix_strategy\
prevention_checks\
confidence\
success_count\
failure_count\
created_at\
last_used_at

context_signature uses general tags only.

Example tags

framework: nextjs\
runtime: node\
storage: postgres\
pattern: async_flow\
failure_mode: race_condition

No file names, no variable names, no code.

------------------------------------------------------------------------

## 12.5 Storage

PatternRecords are stored in a global professional memory directory.

/global/agent_memory/patterns/

Each pattern is a standalone JSON file.\
A search index provides fast lookup.

------------------------------------------------------------------------

## 12.6 Retrieval and Injection

When a runtime is created for a task, retrieval runs before execution.

Steps

Task is classified by task_type and context_signature\
System searches for matching PatternRecords\
Up to 3 patterns with highest confidence are returned\
Patterns are injected into the prompt under a fixed section

Example prompt section

Relevant past patterns

Pattern 1\
Problem: dependency conflict in Node environments\
Strategy: validate dependency tree before build

Pattern 2\
Problem: race condition in async queue\
Strategy: enforce sequential lock or idempotent handler

The agent is instructed to treat these as guidance, not commands.

------------------------------------------------------------------------

## 12.7 Feedback and Confidence

After a task completes, the system records feedback on each used pattern.

If the solution succeeded

success_count increments\
confidence increases

If the solution failed

failure_count increments\
confidence decreases

If confidence falls below the minimum threshold, the pattern is
deactivated.

------------------------------------------------------------------------

## 12.8 Memory Hygiene

Two mechanisms prevent memory bloat.

Deduplication\
If a new pattern is highly similar to an existing one, they are merged.

Decay\
Patterns not used for an extended period drop in ranking.

This keeps memory small and high quality.

------------------------------------------------------------------------

## 12.9 Review as Learning Engine

The reviewer is the primary source of LearningCandidates.

When a reviewer rejects a solution, they record

problem_type\
reason_for_rejection\
recommended_strategy

This data flows into the Reflector which creates or updates a
PatternRecord.

Review is a learning mechanism, not only a quality gate.

------------------------------------------------------------------------

## 12.10 Memory Flow Summary

Learning event occurs\
↓\
Reflector abstracts and cleans\
↓\
PatternRecord stored\
↓\
New task triggers retrieval\
↓\
Patterns injected into prompt\
↓\
Outcome feedback updates confidence

------------------------------------------------------------------------

# 13. Hiring Model

Users hire agents into project slots.

Hiring creates an Allocation record.

Allocation schema

project_id\
agent_id\
role_slot\
allocation_units\
priority_level

Allocation reduces available capacity.

Example

Agent capacity = 10 units\
Project A hires agent with 4 units\
Project B hires agent with 2 units

Agent remaining capacity = 4 units

------------------------------------------------------------------------

# 14. Marketplace Representation

Agents appear in a marketplace interface.

Agent card displays

Name\
Role\
Specialty\
Key Skills\
Work Style\
Model Tier\
Capacity Usage\
Price Tier

Example card

Daniel Carter\
Frontend Architect\
React Performance Specialist\
Work Style: Pragmatic Builder\
Tier: Advanced\
Capacity: 4 of 10 units used

------------------------------------------------------------------------

# 15. Agent Population Strategy

Agents are generated progressively.

Initial population

30 agents

When demand increases

generate 10 additional agents in that specialty.

Agents remain permanent once created.

------------------------------------------------------------------------

# 16. JSON Schemas

## 16.1 AgentProfile

{ "id": "agent_2116", "name": "Daniel Carter", "role": "architect",
"specialty": "frontend_architect", "model_tier": 3, "dna_profile": {
"work_style": "pragmatic_builder", "communication_style": "concise",
"risk_appetite": "balanced", "strength_bias": "performance",
"tooling_bias": "testing_first", "failure_strategy": "isolate_then_fix"
}, "capacity_units": 10, "utilization_units": 0, "base_price": 6,
"performance_multiplier": 1.0 }

## 16.2 Allocation

{ "project_id": "proj_445", "agent_id": "agent_2116", "role_slot":
"frontend_architect", "allocation_units": 4, "priority_level":
"standard" }

------------------------------------------------------------------------

# 17. Agent Generator Algorithm

Pseudo pipeline

generate_agent(role, specialty, tier):

select name from name_bank\
generate dna profile\
generate skills based on role and specialty\
generate system prompt using dna\
assign capacity based on role\
assign base price based on tier\
save agent profile

------------------------------------------------------------------------

# 18. Interaction With Other Systems

After the agent layer is implemented, other platform components
integrate with it.

Wizard Engine

Collects user product idea and generates project brief.

CTO Engine

The CTO Engine is intentionally out of scope for this specification.\
This document assumes the existence of a CTO planning component that
produces three structured outputs consumed by the agent system.

ComplexityReport\
Analysis of the brief including complexity score, technical risk level,
unknowns, and suggested project phases.

TeamBlueprint\
Required roles, recommended specialties, recommended model tier per
role, and recommended capacity units. The CTO does not select specific
agents. It defines which slots are needed.

BuildPlanSkeleton\
Expected PRD sections, architecture requirements, suggested gate policy,
and expected artifacts.

The agent system consumes these outputs. The internal logic of the CTO
Engine is defined in a separate specification.

Scheduler

Distributes tasks between hired agents.

Execution Engine

Executes model calls.

Gate Engine

Validates results.

------------------------------------------------------------------------

End-to-end flow

Wizard collects brief from user\
↓\
CTO Engine produces ComplexityReport, TeamBlueprint, BuildPlanSkeleton\
↓\
User browses marketplace and hires agents into team slots\
↓\
PM Agent writes PRD and breaks work into tasks\
↓\
Architect Agents design system\
↓\
Worker Agents execute tasks\
↓\
Review and Gates validate output

------------------------------------------------------------------------

# 19. Storage Architecture

## 19.1 Core Principle

Files are the canonical source of truth.\
The database is a derived index for querying and UI only.

If the database is unavailable or corrupted, the full system state can
be reconstructed from files alone.

------------------------------------------------------------------------

## 19.2 Project File Layout

Each project stores its state under its own directory.

project_root/\
  project.json\
  brief.json\
  team.json\
  prd.json\
  architecture.json\
  tasks/\
    task_0001.json\
    task_0002.json\
  runs/\
    run_2026_03_04_001.json\
  gates/\
    gate_build.json\
    gate_tests.json\
  artifacts/\
  patches/\
  reports/

------------------------------------------------------------------------

## 19.3 Global File Layout

Agent profiles, allocations, patterns, and pricing live in a global
directory.

/global/\
  agents/\
    agent_2116.json\
  allocations/\
    allocation_projectA_agent2116.json\
  agent_memory/\
    patterns/\
      pattern_0021.json\
  pricing/\
    tiers.json\
    multipliers.json

------------------------------------------------------------------------

## 19.4 Database Role

The database holds only indexes derived from files.

projects_index\
agents_index\
allocations_index\
task_index\
events_index\
price_history_index

Each record contains a pointer to its canonical file.

The database enables fast search, filters, analytics, and dashboards.\
It does not own any data.

------------------------------------------------------------------------

## 19.5 Indexer

An Indexer service watches for file changes and updates the database.

When a file changes or a new result is written, an event is emitted.\
The Indexer reads the file and updates the relevant index records.

------------------------------------------------------------------------

# 20. Future Expansion

Future versions may include

agent reputation systems\
dynamic pricing markets\
agent promotion levels\
training simulations\
external agent marketplace

------------------------------------------------------------------------

End of specification
