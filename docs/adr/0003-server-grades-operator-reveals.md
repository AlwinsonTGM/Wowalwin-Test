# The server grades submissions; the Backbone decides when to show them

Every answer submission is timestamped and graded on arrival by the server, which therefore always knows who submitted first and who was correct. The Backbone shows none of it until a presenter clicks to reveal, so the suspense is a deliberate delay rather than a limitation.

We tried this the other way round first, intending the operator to pick the winner by hand from what they could see, because that keeps the drama in human hands. That works for a bout, where there are two submissions to choose between, and it breaks completely for the cull, where up to forty players submit and nobody can pick a winner out of forty at once. The scale version of the same idea is the grid: every name flips to survived or eliminated simultaneously.

The consequence to preserve in the implementation: correctness is never an operator decision. The server's answer is the answer. The operator only controls *when* it becomes visible. If the two ever come apart, the bracket will silently stop converging, so grading belongs in one tested place with no UI path that can override it.