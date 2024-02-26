import { User } from 'types';

export const users: Record<string, User> = {};

export const createUser = (user: User) => {
  users[user.name] = user;
  return user;
};

export const getUserByName = (userName: string) => {
  return users[userName];
};

export const getUserByIndex = (userIndex: string | number) => {
  return Object.values(users).find((user) => user.index === userIndex);
};

export const getOrCreateUser = (user: User) => {
  const existedUser = getUserByName(user.name);
  if (existedUser && existedUser.password !== user.password) {
    throw new Error('Wrong password');
  }
  return existedUser || createUser(user);
};
