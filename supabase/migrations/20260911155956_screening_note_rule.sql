-- Fifteen readers scoring nine criteria each on ~30 applications were asked
-- for a written note on every 1, 2 and 5. The 2 is a normal below-average
-- rating, not an extreme; keep the note requirement for the ends of the
-- scale only. The client and the member API mirror this rule.
alter table rush.screening_ratings
  drop constraint if exists screening_ratings_extreme_score_note_check;
alter table rush.screening_ratings
  add constraint screening_ratings_extreme_score_note_check
  check (
    score not in (1, 5)
    or char_length(btrim(coalesce(note, ''))) > 0
  ) not valid;

comment on constraint screening_ratings_extreme_score_note_check on rush.screening_ratings is
  'New ratings at the 1 and 5 anchors require a written evidence note; historical rows remain readable.';
