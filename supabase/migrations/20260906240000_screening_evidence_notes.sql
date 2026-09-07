alter table rush.screening_ratings
  add constraint screening_ratings_extreme_score_note_check
  check (
    score not in (1, 2, 5)
    or char_length(btrim(coalesce(note, ''))) > 0
  ) not valid;

comment on constraint screening_ratings_extreme_score_note_check on rush.screening_ratings is
  'New ratings at the 1, 2, and 5 anchors require a written evidence note; historical rows remain readable.';
