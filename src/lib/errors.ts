export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = "AppError"
  }

  static topicRequired() {
    return new AppError("TOPIC_REQUIRED", "No topic selected or provided", 400)
  }

  static projectNotFound() {
    return new AppError("PROJECT_NOT_FOUND", "Project not found", 404)
  }

  static validationFailed(details: unknown) {
    return new AppError("VALIDATION_ERROR", JSON.stringify(details), 400)
  }

  static generationFailed(cause: string) {
    return new AppError("GENERATION_ERROR", cause, 500)
  }

  static scriptNotFound() {
    return new AppError("SCRIPT_NOT_FOUND", "Script version not found", 404)
  }
}
