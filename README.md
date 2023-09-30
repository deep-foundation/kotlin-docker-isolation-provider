# kotlin-docker-isolation-provider

- `/healthz` - GET - 200 - Health check endpoint
  - Response:
    - `{}`
- `/init` - GET - 200 - Initialization endpoint
  - Response:
    - `{}`
- `/call` - GET - 200 - Call executable code of handler in this isolation provider
  - Request:
    - body:
      - params:
        - jwt: STRING - Deeplinks send this token, for create gql and deep client
        - code: STRING - Code of handler
        - data: {} - Data for handler execution from deeplinks
          > If this is type handler
          - oldLink - from deeplinks, link before transaction
          - newLink - from deeplinks, link after transaction
          - promiseId - from deeplinks, promise id
  - Response:
    - `{ resolved?: any; rejected?: any; }` - If resolved or rejected is not null, then it's result of execution


## Examples
```kt
suspend fun fn(args: dynamic):Any {
    val deep = args.deep
    val data = args.data

    val resultPromise = deep.id("@deep-foundation/core", "Symbol").then { result ->
        val insertData = object {
            val type_id = result
            val string = "DeepFoundation".reversed()
            val from_id = data.newLink.id
            val to_id = data.newLink.id
        }
        deep.insert(insertData)
    }

    return resultPromise
}
```

## Restart docker

```bash
npm ci
npm run package:build
docker build -t kotlin-docker-isolation-provider .

docker run -d -p 31190:31190 -e PORT=31190 kotlin-docker-isolation-provider

docker ps
```
