import Joi from 'joi';

const tagsSchema = Joi.array()
  .items(Joi.string().trim().max(50))
  .max(20)
  .default([]);

export const upsertTeamNoteSchema = {
  body: Joi.object({
    text: Joi.string().trim().max(4000).required(),
    tags: tagsSchema
  })
};

export const upsertPlayerNoteSchema = {
  body: Joi.object({
    playerId: Joi.string().trim().required(),
    text: Joi.string().trim().max(4000).required(),
    tags: tagsSchema
  })
};

