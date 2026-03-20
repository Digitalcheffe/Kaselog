namespace KaseLog.Api.Models;

public sealed class CollectionItemValidationException : Exception
{
    public IReadOnlyDictionary<string, string[]> FieldErrors { get; }

    public CollectionItemValidationException(IReadOnlyDictionary<string, string[]> fieldErrors)
        : base("One or more required fields are missing or empty.")
    {
        FieldErrors = fieldErrors;
    }
}
