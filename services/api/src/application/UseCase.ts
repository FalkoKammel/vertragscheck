export interface UseCase<InputType, OutputType> {
  execute: (input: InputType) => OutputType | Promise<OutputType>;
}
