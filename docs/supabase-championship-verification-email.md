# Championship Verification Email Function

The public championship page calls this Supabase Edge Function when a member
submits a points verification request:

`send-championship-verification-request`

The frontend sends a structured JSON payload with:

- `association.id`, `association.name`, `association.shortName`
- `season.id`, `season.title`, `season.year`, `season.status`, `season.updatedAt`
- `requester.name`, `requester.email`
- `request.classId`, `request.className`
- `request.scope`: `selected_shows` or `season`
- `request.shows`: selected class occurrences, or all class occurrences for the season
- `request.rider`, `request.horse`, `request.explanation`
- `currentStanding`: current points/rank/details when the rider/horse pair matches
- `championshipUrl`

Server-side expectations:

- Resolve association admins/managers on the server from `association.id`.
- Send the email from the existing configured sender: `noreply@showscore.app`.
- Do not trust recipient addresses from the public frontend.
- Include the requester email as reply context in the message body or reply-to.
- Include the championship URL and current standing snapshot when present.
- Return `{ "ok": true }` on success.

This keeps the public page lightweight while preserving the existing Supabase
email boundary used by ShowScore.
