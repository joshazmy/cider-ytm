BEGIN IMMEDIATE;

INSERT INTO settings (key, value)
VALUES (
	'queue_json',
	'{"items":[{"video_id":"LOCAL:/nonexistent/yapel-e2e-current.mp3","title":"Deterministic Current","artists":"Yapel Test","artist_id":null,"artist_runs":[],"album":"Native E2E","album_id":null,"duration":"3:20","play_count":null,"thumbnail":null,"set_video_id":null,"rating":null,"queued_by":null,"queued":false,"queued_end":false,"queued_from":null,"autoplay":false,"is_video":false,"explicit":false},{"video_id":"LOCAL:/nonexistent/yapel-e2e-upcoming.mp3","title":"Deterministic Upcoming","artists":"Yapel Test","artist_id":null,"artist_runs":[],"album":"Native E2E","album_id":null,"duration":"4:10","play_count":null,"thumbnail":null,"set_video_id":null,"rating":null,"queued_by":null,"queued":true,"queued_end":false,"queued_from":null,"autoplay":false,"is_video":false,"explicit":false}],"current":0,"playedFrom":0,"repeat":"off","shuffleOrig":null,"radioSeed":null,"sourceName":"Native E2E","radio":false}'
)
ON CONFLICT(key) DO UPDATE SET value = excluded.value;

COMMIT;
