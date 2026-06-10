-- Phase 0 · Migration 1: extensions + enums (PRD §10.1)

create extension if not exists pgcrypto;

create type public.member_role as enum (
  'board',
  'recruitment_committee',
  'general_member'
);

create type public.candidate_stage as enum (
  'applied',
  'speed_dating',
  'group_case',
  'interview',
  'hash',
  'decided'
);

-- No 'open_rush' value: open rush is a cycle property (PRD J2), not a candidate status.
create type public.candidate_status as enum (
  'active',
  'advanced',
  'cut',
  'waitlisted',
  'withdrawn',
  'accepted',
  'rejected'
);

-- Encodings: strong_yes +2, yes +1, no -1, strong_no -2 (used by controversy fallback).
create type public.reaction_value as enum (
  'strong_yes',
  'yes',
  'no',
  'strong_no'
);

create type public.vote_value as enum (
  'advance',
  'cut',
  'discuss'
);

create type public.decision_value as enum (
  'accepted',
  'rejected',
  'waitlisted'
);

create type public.hash_visibility as enum (
  'anonymous',
  'open'
);

create type public.audit_action as enum (
  'candidate_created',
  'candidate_stage_advanced',
  'candidate_status_changed',
  'score_saved',
  'score_submitted',
  'score_edit_reopened',
  'note_created',
  'note_updated',
  'note_soft_deleted',
  'reaction_set',
  'coi_flagged',
  'coi_exclusion_toggled',
  'evaluator_assigned',
  'hash_session_started',
  'hash_session_ended',
  'hash_visibility_changed',
  'hash_participant_added',
  'vote_cast',
  'decision_recorded',
  'rubric_version_created',
  'rubric_version_activated',
  'member_role_changed',
  'member_soft_deleted',
  'invite_created',
  'invite_consumed',
  'cycle_created',
  'cycle_open_rush_toggled'
);
