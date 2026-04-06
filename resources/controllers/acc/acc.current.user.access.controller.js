const { fetchProjects } = require("../../libs/aec/aec.get.project")
const { fetchHubs } = require("../../libs/aec/aec.get.hubs")
const { fetchAccProjectUserDetails } = require("../../libs/acc/acc.get.project.user.details")
const { fetchAccProjectUsers } = require("../../libs/acc/acc.get.project.users")
const {
  fetchAuthenticatedUserProfile,
} = require("../auth/auth.user.profile.controller")

const HUBNAME = process.env.HUBNAME
const READ_ONLY_ROLE_NAME = "DEP_CONSTRUCCION"
const UUID_LIKE_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const normalizeValue = (value) => String(value || "").trim()
const normalizeLookupValue = (value) => normalizeValue(value).toLowerCase()
const normalizeRoleName = (value) => normalizeValue(value).toUpperCase()

async function resolveAccProjectId(token, projectId) {
  const rawProjectId = normalizeValue(projectId)

  if (!rawProjectId) {
    const err = new Error("projectId is required")
    err.status = 400
    err.code = "MissingProjectId"
    throw err
  }

  if (rawProjectId.startsWith("b.")) return rawProjectId
  if (UUID_LIKE_REGEX.test(rawProjectId)) return `b.${rawProjectId}`

  const aecHubs = await fetchHubs(token)
  const matchedAecHub = (aecHubs || []).find((hub) => hub?.name === HUBNAME)

  if (!matchedAecHub) {
    const err = new Error(`AEC Hub not found: ${HUBNAME}`)
    err.status = 404
    err.code = "AECHubNotFound"
    throw err
  }

  const aecProjects = await fetchProjects(token, matchedAecHub.id)
  const matchedProject = (aecProjects || []).find(
    (project) => normalizeValue(project?.id) === rawProjectId
  )
  const accProjectId = normalizeValue(
    matchedProject?.alternativeIdentifiers?.dataManagementAPIProjectId
  )

  if (!accProjectId) {
    const err = new Error("ACC project identifier could not be resolved")
    err.status = 404
    err.code = "ACCProjectIdNotResolved"
    throw err
  }

  return accProjectId
}

function buildProjectUserLookup(profile = {}) {
  const directUserId = normalizeValue(profile?.userId || profile?.uid)
  const lookupValues = new Set(
    [
      directUserId,
      normalizeValue(profile?.emailId || profile?.email),
      normalizeValue(profile?.userName),
    ]
      .map(normalizeLookupValue)
      .filter(Boolean)
  )

  return { directUserId, lookupValues }
}

function findMatchedProjectUser(projectUsers, lookupValues) {
  if (!lookupValues?.size) return null

  return (projectUsers || []).find((projectUser) => {
    const userCandidates = [
      projectUser?.id,
      projectUser?.analyticsId,
      projectUser?.autodeskId,
      projectUser?.email,
    ]
      .map(normalizeLookupValue)
      .filter(Boolean)

    return userCandidates.some((candidate) => lookupValues.has(candidate))
  }) || null
}

async function resolveCurrentAccProjectUser(token, accProjectId, profile) {
  const { directUserId, lookupValues } = buildProjectUserLookup(profile)
  let directLookupError = null

  if (directUserId) {
    try {
      const userDetail = await fetchAccProjectUserDetails(
        token,
        accProjectId,
        directUserId
      )

      return {
        resolvedUserId: directUserId,
        userDetail,
      }
    } catch (error) {
      const status = error?.response?.status
      if (status && status !== 400 && status !== 404) throw error
      directLookupError = error
    }
  }

  const projectUsers = await fetchAccProjectUsers(token, accProjectId)
  const matchedProjectUser = findMatchedProjectUser(projectUsers, lookupValues)

  if (!matchedProjectUser?.id) {
    const err = directLookupError || new Error("Current ACC project user not found")
    err.status = err.status || err?.response?.status || 404
    err.code = err.code || "ACCProjectUserNotFound"
    throw err
  }

  const userDetail = await fetchAccProjectUserDetails(
    token,
    accProjectId,
    matchedProjectUser.id
  )

  return {
    resolvedUserId: normalizeValue(matchedProjectUser.id),
    userDetail,
  }
}

const GetCurrentUserProjectAccess = async (req, res, next) => {
  try {
    const token = req.cookies?.access_token

    if (!token) {
      const err = new Error("Access token is required")
      err.status = 401
      err.code = "Unauthorized"
      return next(err)
    }

    const requestedProjectId = req.params?.projectId
    const authProfile = await fetchAuthenticatedUserProfile(token)
    const accProjectId = await resolveAccProjectId(token, requestedProjectId)
    const { resolvedUserId, userDetail } = await resolveCurrentAccProjectUser(
      token,
      accProjectId,
      authProfile
    )

    const roles = Array.isArray(userDetail?.roles)
      ? userDetail.roles
          .map((role) => normalizeValue(role?.name))
          .filter(Boolean)
      : []
    const matchedRole =
      (userDetail?.roles || []).find(
        (role) => normalizeRoleName(role?.name) === READ_ONLY_ROLE_NAME
      )?.name || null

    res.set("Cache-Control", "no-store")

    return res.status(200).json({
      success: true,
      projectId: accProjectId,
      userId: resolvedUserId || normalizeValue(authProfile?.userId || authProfile?.uid) || null,
      matchedRole,
      isReadOnlyAccess: Boolean(matchedRole),
      roles,
    })
  } catch (err) {
    if (!err.status && err?.response?.status) {
      err.status = err.response.status
    }

    console.warn(
      "Error resolving current ACC project access:",
      err?.response?.data || err?.message || err
    )

    err.code = err.code || "ACCCurrentUserAccessFailed"
    return next(err)
  }
}

module.exports = { GetCurrentUserProjectAccess }
