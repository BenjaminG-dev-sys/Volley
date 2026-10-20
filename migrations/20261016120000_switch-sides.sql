ALTER TABLE public.match_events DROP CONSTRAINT match_events_type_check;
ALTER TABLE public.match_events ADD CONSTRAINT match_events_type_check CHECK (type IN (
  'coin_toss', 'lineup', 'point', 'timeout', 'switch_sides', 'substitution',
  'libero_in', 'libero_out', 'sanction', 'undo', 'close', 'reopen'
));
