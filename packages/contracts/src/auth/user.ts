/** A control-plane user as the API returns it. The password hash has no place here. */
export interface UserDto {
  id: string;
  email: string;
  name: string;
}
