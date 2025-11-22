# Project Instructions for Claude

## Communication

- Always respond in Japanese

## Code Quality

- Follow best practices for each programming language
- Always add a newline at the end of each file
- Always run formatters before completing tasks
- Always run linters and fix errors
- Always check compilation error and fix it.
- Minor linter warnings may be ignored
- When you edit TypeScript, always use undefined instead of null if you can.
- Write comments only for function, interface. Don't put comments for plain flow.
- Manipulating of DOM elements directly in the React component is not basically allowed

## Development Workflow

- Format code: Run appropriate formatters. for ts files, run `npm run format`. for rust files, run `cargo fmt`
- Lint code: Run linters and address errors (warnings can be ignored if minor)
- Ensure code quality standards are met before marking tasks as complete
