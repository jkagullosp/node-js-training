| Scenario | HTTP Status | Explanation |
| -------- | ----------- | ----------- |
| User successfully loggeed in | 200 OK | The request succeeded, 200 OK is the standard status code.
| User tried to access a page without being logged in | 401 Unauthorized | The client must authenticate itself to get the requested response.
| User is logged in but tried to access another user's private data | 403 Forbidden | The client is known (logged in) but does not have the correct permissions/access rights for the specific resource.
| User reqested a blog post that doesn't exist | 404 Not Found | The requested resource is not available.
| User successfully created a new task | 201 Created | The request succeeded, and a new resource was created.
| User sent a POST request with invalid JSON | 400 Bad Request | The server cannot process the request due to a client error.
| User deleted a task successfully | 204 No Content | The server successfully processed the request and is not returning any content in the response body.
| Database is down and the server can't handle the request | 500 Internal Server Error | The server encountered an unexpected condition that precented it from fulfilling the request.
| User exceeded the rate limit | 429 Too Many Requests | The user has sent too many requests in a given amount of time "Rate Limiting"
| User requested data and got it successfully | 200 OK | The standard response for successful HTTP requests, especially GET requests returning data.